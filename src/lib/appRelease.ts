import "server-only";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";

/**
 * The published Android release, described by public/downloads/asm-portal.json.
 * That file is written by `gradlew publishApk` (android/app/build.gradle.kts)
 * next to the APK itself, and both are committed together.
 */
export const APK_PUBLIC_PATH = "/downloads/asm-portal.apk";
const MANIFEST_FILE = path.join(process.cwd(), "public", "downloads", "asm-portal.json");
const APK_FILE = path.join(process.cwd(), "public", "downloads", "asm-portal.apk");

const releaseSchema = z.object({
  versionCode: z.number().int().positive(),
  versionName: z.string().min(1).max(40),
  minVersionCode: z.number().int().positive().default(1),
  sha256: z.string().regex(/^[a-f0-9]{64}$/i),
  size: z.number().int().positive(),
  notes: z.array(z.string().max(500)).max(30).default([]),
  publishedAt: z.string().optional(),
  apk: z.string().default(APK_PUBLIC_PATH),
});
export type AppRelease = z.infer<typeof releaseSchema>;

/** The published release, or null when no APK/manifest is deployed (or it is malformed). */
export async function readAppRelease(): Promise<AppRelease | null> {
  try {
    const [raw, apk] = await Promise.all([readFile(MANIFEST_FILE, "utf8"), stat(APK_FILE)]);
    if (!apk.isFile() || apk.size === 0) return null;
    const release = releaseSchema.parse(JSON.parse(raw));
    // Never advertise a minimum the published APK itself does not satisfy.
    return { ...release, minVersionCode: Math.min(release.minVersionCode, release.versionCode) };
  } catch {
    return null;
  }
}

/** Cache-busting download URL, so a browser or proxy never serves an older APK. */
export function apkDownloadPath(release: Pick<AppRelease, "apk" | "versionCode">): string {
  return `${release.apk}?v=${release.versionCode}`;
}
