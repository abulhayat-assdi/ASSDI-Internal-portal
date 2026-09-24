import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";
import { getClientIp, limitFromEnv } from "@/lib/rateLimit";
import { getCourseById } from "@/lib/course";
import { buildAssistantPrompt, getAiKnowledge } from "@/lib/aiAssistant";
import { PLATFORM_NAME } from "@/types/branding";

// ============================================================
// 🛡️ In-memory IP-based Rate Limiter
// Limits each IP to MAX_REQUESTS_PER_WINDOW requests per window.
// NOTE: This resets on server restart and is per-instance only.
// For production at scale, use Redis or a distributed store.
// ============================================================
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
// Shared campus connections: this is per IP, so it has to accommodate a
// room full of people, not one person.
const MAX_REQUESTS_PER_WINDOW = limitFromEnv("CHAT", 30);

interface RateLimitEntry {
    count: number;
    resetAt: number;
}

const rateLimitMap = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes to prevent memory leaks
setInterval(() => {
    const now = Date.now();
    for (const [ip, entry] of rateLimitMap) {
        if (now > entry.resetAt) {
            rateLimitMap.delete(ip);
        }
    }
}, 5 * 60 * 1000);

function isRateLimited(ip: string): boolean {
    const now = Date.now();
    const entry = rateLimitMap.get(ip);

    if (!entry || now > entry.resetAt) {
        // First request or window expired — start a new window
        rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
        return false;
    }

    entry.count++;
    if (entry.count > MAX_REQUESTS_PER_WINDOW) {
        return true;
    }

    return false;
}

// কোর্স সম্পর্কিত তথ্য কোর্স রেকর্ড থেকেই আসে — এখানে হার্ডকোড করা নেই।
// প্রতিটি কোর্স তার নিজের নাম/ট্যাগলাইন ও Dashboard → Branding-এ লেখা
// knowledge টেক্সট দিয়ে নিজস্ব প্রম্পট পায় (@/lib/aiAssistant দেখুন)।
async function resolveSystemPrompt(request: NextRequest): Promise<string> {
    const courseId = request.headers.get("x-course-id");
    const course = courseId ? await getCourseById(courseId).catch(() => null) : null;
    return buildAssistantPrompt(
        course?.name ?? PLATFORM_NAME,
        course?.tagline ?? null,
        getAiKnowledge(course?.settings ?? null)
    );
}

// ============================================================
// Model fallback chain — tried in order until one succeeds.
// Primary: cutting-edge models. Fallback: stable LTS models.
// ============================================================
const MODELS = [
    "gemini-2.0-flash",          // Latest experimental — try first
    "gemini-1.5-flash",          // Stable, widely available fallback
    "gemini-1.5-pro",            // Stable pro fallback
    "gemini-2.0-pro-exp",        // Experimental pro (may have quota limits)
];

// ============================================================
// Maximum allowed user message length (chars)
// ============================================================
const MAX_MESSAGE_LENGTH = 2000;

// ============================================================
// Prompt injection patterns
// These patterns attempt to override the system prompt or
// break out of the assistant's constrained role.
// ============================================================
const INJECTION_PATTERNS: RegExp[] = [
    /ignore\s+(all\s+)?(previous|prior|above|system)\s+(instructions?|prompts?|context)/i,
    /you\s+are\s+now\s+(a\s+)?/i,
    /pretend\s+(you\s+are|to\s+be)/i,
    /act\s+as\s+(a\s+)?(different|new|another)/i,
    /disregard\s+(your\s+)?(previous|prior|system|all)/i,
    /system\s*:\s*/i,
    /<\s*\|?\s*(system|inst|user|assistant)\s*\|?\s*>/i,  // <|system|> style tokens
    /###\s*(system|instruction|prompt)/i,
    /\[INST\]/i,
    /\[\/INST\]/i,
    /reveal\s+(your\s+)?(system\s+)?prompt/i,
    /what\s+(are|is)\s+your\s+(system\s+)?instructions?/i,
];

/**
 * Sanitizes user input before forwarding to the Gemini API.
 *
 * Returns { safe: true, message } if clean, or
 *         { safe: false, reason } if injection is detected.
 */
function sanitizeInput(raw: string): { safe: true; message: string } | { safe: false; reason: string } {
    // Trim and enforce length limit
    const trimmed = raw.trim();

    if (trimmed.length === 0) {
        return { safe: false, reason: "Message cannot be empty." };
    }

    if (trimmed.length > MAX_MESSAGE_LENGTH) {
        return {
            safe: false,
            reason: `Message is too long. Please keep it under ${MAX_MESSAGE_LENGTH} characters.`,
        };
    }

    // Check for prompt injection patterns
    for (const pattern of INJECTION_PATTERNS) {
        if (pattern.test(trimmed)) {
            return {
                safe: false,
                reason: "Your message contains content that cannot be processed.",
            };
        }
    }

    return { safe: true, message: trimmed };
}

// ============================================================
// Chat message type for history
// ============================================================
interface ChatMessage {
    role: "user" | "model";
    parts: string;
}

export async function POST(request: NextRequest) {
    const body = await request.json();

    // Admin-student chat: payload has studentUid
    if (body.studentUid !== undefined) {
        const user = await getSessionUser(request);
        if (!user || !user.courseId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        const courseId = user.courseId;

        const { studentUid, sender, text, attachments = [], studentProfileInfo } = body;

        const message = await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            // Upsert chat thread
            await tx.chatThread.upsert({
                where: { studentUid },
                update: {
                    lastMessageText: text,
                    lastMessageTime: new Date(),
                    ...(sender === "admin"
                        ? { unreadCountStudent: { increment: 1 } }
                        : { unreadCountAdmin: { increment: 1 } }),
                },
                create: {
                    courseId,
                    studentUid,
                    studentName: studentProfileInfo?.name || "Unknown",
                    studentEmail: studentProfileInfo?.email || "",
                    studentBatchName: studentProfileInfo?.batch || "",
                    studentRoll: studentProfileInfo?.roll || "",
                    lastMessageText: text,
                    lastMessageTime: new Date(),
                    unreadCountAdmin: sender === "student" ? 1 : 0,
                    unreadCountStudent: sender === "admin" ? 1 : 0,
                },
            });

            const thread = await tx.chatThread.findUnique({ where: { studentUid } });
            return tx.chatMessage.create({
                data: {
                    courseId,
                    threadId: thread!.id,
                    senderId: user.id,
                    sender,
                    text,
                    attachments,
                },
            });
        });

        return NextResponse.json({ success: true, id: message.id });
    }

    // AI chatbot: payload has message
    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "AI Assistant is currently disabled." }, { status: 503 });
    }
    // ── Rate limiting ─────────────────────────────────────
    // getClientIp reads the proxy chain from the right. The previous
    // leftmost-of-x-forwarded-for read was attacker-controlled, so a single
    // client could mint a fresh bucket per request and burn the Gemini quota.
    const ip = getClientIp(request);

    if (isRateLimited(ip)) {
        return NextResponse.json(
            { error: "Too many requests. Please wait a minute before trying again." },
            { status: 429 }
        );
    }

    try {
        const { message, history } = body as { message: unknown; history?: unknown };

        // ── Input validation ──────────────────────────────────
        if (!message || typeof message !== "string") {
            return NextResponse.json({ error: "Message is required" }, { status: 400 });
        }

        const sanitized = sanitizeInput(message);
        if (!sanitized.safe) {
            return NextResponse.json({ error: sanitized.reason }, { status: 400 });
        }

        // Validate and shape the history array (ignore malformed entries)
        const safeHistory: ChatMessage[] = [];
        if (Array.isArray(history)) {
            for (const item of history) {
                if (
                    item &&
                    typeof item === "object" &&
                    (item.role === "user" || item.role === "model") &&
                    typeof item.parts === "string" &&
                    item.parts.trim().length > 0
                ) {
                    // Sanitize each historical message too
                    const histSanitized = sanitizeInput(item.parts);
                    if (histSanitized.safe) {
                        safeHistory.push({ role: item.role, parts: histSanitized.message });
                    }
                }
            }
        }

        // ── API key ───────────────────────────────────────────
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: "API key not configured" }, { status: 500 });
        }

        // ── Build contents array with history + current message ─
        // Gemini expects alternating user/model turns, so we push all
        // history turns first, then the current user message.
        const contents = [
            ...safeHistory.map((msg: any) => ({
                role: msg.role,
                parts: [{ text: msg.parts }],
            })),
            {
                role: "user",
                parts: [{ text: sanitized.message }],
            },
        ];

        const requestBody = JSON.stringify({
            system_instruction: {
                parts: [{ text: await resolveSystemPrompt(request) }],
            },
            contents,
            generationConfig: {
                temperature: 0.7,
                maxOutputTokens: 512,
            },
        });

        // ── Model fallback loop ───────────────────────────────
        for (const model of MODELS) {
            const response = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: requestBody,
                }
            );

            if (response.status === 404 || response.status === 429) {
                // Model not available or rate-limited — try next
                continue;
            }

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                console.error(`Gemini API error (${model}):`, errorData);
                continue;
            }

            const data = await response.json();
            const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
            const aiText =
                text ||
                "Sorry, I couldn't generate a response. Please try again.";

            return NextResponse.json({ reply: aiText });
        }

        // সব model fail হলে friendly message
        return NextResponse.json(
            {
                reply: "আমাদের AI Assistant এখন একটু ব্যস্ত আছে। অনুগ্রহ করে ৩০ সেকেন্ড পরে আবার চেষ্টা করুন। সরাসরি যোগাযোগের জন্য ফোন করুন: 01862534626",
            },
            { status: 200 }
        );
    } catch (error) {
        console.error("Chat API error:", error);
        return NextResponse.json({ error: "Internal server error" }, { status: 500 });
    }
}

/** DELETE /api/chat?studentUid=... — delete chat thread + all messages */
export async function DELETE(req: NextRequest) {
    const user = await getSessionUser(req);
    if (!user || !isAdmin(user) || !user.courseId) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    const courseId = user.courseId;
    const { searchParams } = new URL(req.url);
    const studentUid = searchParams.get("studentUid");
    if (!studentUid) return NextResponse.json({ error: "studentUid required" }, { status: 400 });
    try {
        return await withCourseContext({ courseId, isSuperAdmin: false }, async (tx) => {
            const thread = await tx.chatThread.findUnique({ where: { studentUid, courseId } });
            if (!thread) return NextResponse.json({ error: "Not found" }, { status: 404 });
            await tx.chatMessage.deleteMany({ where: { threadId: thread.id } });
            await tx.chatThread.delete({ where: { id: thread.id } });
            return NextResponse.json({ success: true });
        });
    } catch (error) {
        console.error("[Chat DELETE]", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
