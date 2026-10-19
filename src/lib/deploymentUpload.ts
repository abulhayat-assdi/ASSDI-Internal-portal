import "server-only";
import type { NextRequest } from "next/server";
import { rateLimit, limitFromEnv, HOUR } from "@/lib/rateLimit";
import {
    fileSizeProblem,
    fileTypeProblem,
    htmlContentProblem,
    uploadKind,
    type UploadKind,
} from "@/lib/deploymentRules";

/** Request-level helpers shared by the deployment create (POST) and update (PUT) routes. */

/** Reads and checks the uploaded file of a create/update request. */
export async function readDeployUpload(
    formData: FormData
): Promise<{ file: File; kind: UploadKind; buffer: Buffer } | { error: string; status: number }> {
    const fileField = formData.get("file");
    const file = fileField instanceof File ? fileField : null;
    if (!file) return { error: "কোনো ফাইল আসেনি। একটি .html বা .zip ফাইল সিলেক্ট করুন।", status: 400 };

    const typeError = fileTypeProblem(file.name);
    if (typeError) return { error: typeError, status: 400 };
    const sizeError = fileSizeProblem(file.size);
    if (sizeError) return { error: sizeError, status: 413 };
    const kind = uploadKind(file.name)!;

    const buffer = Buffer.from(await file.arrayBuffer());
    if (kind === "html") {
        const htmlError = htmlContentProblem(buffer);
        if (htmlError) return { error: htmlError, status: 422 };
    }
    return { file, kind, buffer };
}

/** Parses multipart form data, turning a truncated/aborted upload into a clear message. */
export async function readFormData(req: NextRequest): Promise<FormData | null> {
    try {
        return await req.formData();
    } catch (err) {
        console.error("[Deployments] formData", err);
        return null;
    }
}

export const UPLOAD_INCOMPLETE = "আপলোড সম্পূর্ণভাবে সার্ভারে পৌঁছায়নি (ইন্টারনেট সংযোগ কেটে গিয়ে থাকতে পারে)। ইন্টারনেট চেক করে আবার চেষ্টা করুন।";
export const SERVER_ERROR = "ডিপ্লয় করার সময় সার্ভারে সমস্যা হয়েছে। এক মিনিট পর আবার চেষ্টা করুন; বারবার হলে ইনস্ট্রাক্টরকে জানান।";

/** Uploads per student per hour (create + update together). */
export function deployRateLimited(userId: string): boolean {
    return !rateLimit(`deploy:${userId}`, limitFromEnv("DEPLOY_UPLOADS_PER_HOUR", 20), HOUR).ok;
}
export const RATE_LIMITED = "এক ঘণ্টায় অনেকবার আপলোড করা হয়েছে। কিছুক্ষণ পর আবার চেষ্টা করুন।";

