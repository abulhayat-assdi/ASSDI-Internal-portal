import { NextRequest, NextResponse } from "next/server";
import { withCourseContext } from "@/lib/db";
import { getSessionUser, isAdmin } from "@/lib/auth";

// ============================================================
// 🛡️ In-memory IP-based Rate Limiter
// Limits each IP to MAX_REQUESTS_PER_WINDOW requests per window.
// NOTE: This resets on server restart and is per-instance only.
// For production at scale, use Redis or a distributed store.
// ============================================================
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

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

// কোর্স সম্পর্কিত সব তথ্য — Gemini শুধু এই বিষয়ে উত্তর দেবে
const SYSTEM_PROMPT = `You are a helpful and professional AI assistant for "The Art of Sales & Marketing" course offered by As-Sunnah Skill Development Institute (আস-সুন্নাহ স্কিল ডেভেলপমেন্ট ইনস্টিটিউট).

Your role is to answer questions about this course only. Here is everything you know:

COURSE DETAILS:
- Course Name: The Art of Sales & Marketing (সেলস ও মার্কেটিং কোর্স)
- Institute: As-Sunnah Skill Development Institute (আস-সুন্নাহ স্কিল ডেভেলপমেন্ট ইনস্টিটিউট)
- Location: আলি নগর গেটের বিপরীত পাশের বিল্ডিং, সাতারকুল রোড, উত্তর বাড্ডা, ঢাকা
- Duration: 90 Days (পুরুষদের জন্য ৯০ দিনের আবাসিক কোর্স)
- Price: 70,000 BDT (কোর্সের মোট ফি ৭০,০০০ টাকা। এর মধ্যে ভর্তি ফি ১০,০০০ টাকা দেওয়া বাধ্যতামূলক এবং বাকি কোর্স ফি ও আবাসন ফি ৬০,০০০ টাকা। আর্থিক অস্বচ্ছলতার প্রমাণ সাপেক্ষে ১০০% পর্যন্ত স্কলারশিপ দেওয়া হয়)
- Contact Email: abul.hayat@skill.assunnahfoundation.org
- Phone: 01862534626 (Available 9am–5pm)
- Certificate: Yes, official certification upon completion
- Audience: Students, Job Seekers, Entrepreneurs, Ethical Learners 

COURSE HIGHLIGHTS:
- Suitable for absolute beginners — no prior experience required
- Based on pure ethics and 100% practical knowledge
- Focuses on Halal income, Dawah, and ethical growth in the corporate world.
- Lifetime access to course networking and support

TOPICS COVERED (9 Modules):
1. Sales Mastery
2. Career Planning & Branding
3. Customer Service Excellence
4. AI for Digital Marketers
5. Digital Marketing
6. Business Management Tools (MS Office)
7. Landing Page & Content Marketing
8. Business English
9. Dawah & Business Ethics

GUIDELINES:
- No matter what language the user types in (Bengali, English, or Banglish), you MUST reply in Modern, Professional Bengali mixed with English corporate terms (e.g., "কোর্স আউটলাইন", "স্কিলস", "অ্যাডমিশন", "ইন্টারভিউ", "ক্যারিয়ার", "অ্যাসাইনমেন্ট").
- Always address the user politely using "আপনি" (Aapni / You). Never use informal words like "ব্রায়", "চিল", "প্যারা", "ব্রো". 
- Maintain a highly professional, respectful, and corporate tone.
- Write the Bengali text using Bengali script (বাংলা অক্ষর).
- Keep answers concise, informative, and to the point (2-4 sentences unless more detail is requested).
- If someone asks something outside this course, politely say you can only help about this course.
- Never make up information not listed above.`;

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
    const ip =
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip") ||
        "unknown";

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
                parts: [{ text: SYSTEM_PROMPT }],
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
