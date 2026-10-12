/**
 * Server-side backstop for the "no typing exam on a phone" rule. The student
 * pages already hide the exam on touch devices; this stops a session being
 * opened by a phone that reaches the API anyway.
 *
 * Best-effort by nature: a request header can be spoofed, and a tablet asking
 * for the "desktop site" sends a desktop User-Agent. It only has to catch the
 * ordinary case of a student opening the exam on their phone.
 */
export function isMobileRequest(headers: Headers): boolean {
    if (headers.get("sec-ch-ua-mobile") === "?1") return true;
    return MOBILE_USER_AGENT.test(headers.get("user-agent") || "");
}

/** Shared with the browser-side check (useExamDeviceBlocked), which must block at least everything this does. */
export const MOBILE_USER_AGENT = /Mobi|Android|iPhone|iPod|iPad/i;

export const MOBILE_BLOCKED_MESSAGE =
    "টাইপিং পরীক্ষা মোবাইলে দেওয়া যায় না। কিবোর্ডসহ কম্পিউটার বা ল্যাপটপ থেকে লগইন করে পরীক্ষা দিন।";
