import { PLATFORM_NAME, PLATFORM_NAME_BN } from '@/types/branding';

/**
 * Per-course knowledge base for the public AI assistant.
 *
 * The facts an assistant needs (fees, duration, contact, module list) differ
 * for every course, so they are stored on the course itself
 * (`Course.settings.aiAssistant.knowledge`, edited from Dashboard → Branding)
 * instead of being written into the code for one particular course.
 */
export function getAiKnowledge(settings: unknown): string {
    const raw = (settings as { aiAssistant?: { knowledge?: unknown } } | null)?.aiAssistant?.knowledge;
    return typeof raw === 'string' ? raw.trim() : '';
}

export function buildAssistantPrompt(
    courseName: string,
    tagline: string | null,
    knowledge: string
): string {
    const details = knowledge
        ? knowledge
        : [
              `- Course Name: ${courseName}`,
              tagline ? `- About: ${tagline}` : null,
              `- Institute: ${PLATFORM_NAME} (${PLATFORM_NAME_BN})`,
          ]
              .filter(Boolean)
              .join('\n');

    return `You are a helpful and professional AI assistant for the "${courseName}" course offered by ${PLATFORM_NAME} (${PLATFORM_NAME_BN}).

Your role is to answer questions about this course only. Here is everything you know:

COURSE DETAILS:
${details}

GUIDELINES:
- No matter what language the user types in (Bengali, English, or Banglish), you MUST reply in Modern, Professional Bengali mixed with English corporate terms (e.g., "কোর্স আউটলাইন", "স্কিলস", "অ্যাডমিশন", "ইন্টারভিউ", "ক্যারিয়ার", "অ্যাসাইনমেন্ট").
- Always address the user politely using "আপনি" (Aapni / You). Never use informal words like "ব্রায়", "চিল", "প্যারা", "ব্রো".
- Maintain a highly professional, respectful, and corporate tone.
- Write the Bengali text using Bengali script (বাংলা অক্ষর).
- Keep answers concise, informative, and to the point (2-4 sentences unless more detail is requested).
- If someone asks something outside this course, politely say you can only help about this course.
- Never make up information not listed above. If a detail (fee, schedule, contact) is not listed, say you don't have it and suggest contacting the institute.`;
}
