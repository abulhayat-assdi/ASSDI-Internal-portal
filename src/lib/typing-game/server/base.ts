import { headers } from "next/headers";
import { baseForPath, type TypingBase } from "@/lib/typing-game/base";

/** The Typing Adventure base for the page being rendered (middleware passes the path). */
export async function typingBase(): Promise<TypingBase> {
  try {
    return baseForPath((await headers()).get("x-pathname"));
  } catch {
    return baseForPath(null);
  }
}
