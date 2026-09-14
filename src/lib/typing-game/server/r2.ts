/**
 * Local-storage glue for the typing-game's private assets (avatars today —
 * see `../visibility.ts`'s `SIGNABLE_PREFIXES`).
 *
 * Ported from the typing-game monorepo's Cloudflare R2 + `@aws-sdk/client-s3`
 * presigned-URL scheme. ASM has no R2/S3 — file storage is a local disk
 * volume under `LOCAL_STORAGE_PATH`, served through authenticated Route
 * Handlers (see `src/app/api/storage/upload/route.ts` and
 * `src/app/api/uploads/[...path]/route.ts`, the pattern this file mirrors).
 * There is no "signed URL" concept here: a request either carries a valid
 * ASM session and is allowed to read/write the key, or it is rejected by the
 * Route Handler — see `src/app/api/typing-game/avatars/[...key]/route.ts`.
 */
import fs from "fs";
import path from "path";
import { parseR2Key, type R2Prefix } from "@/lib/typing-game/r2/keys";
import { isSignable } from "@/lib/typing-game/r2/visibility";

/** Base directory for all typing-game local assets (own sub-tree of the shared volume). */
export function storageBase(): string {
  const configured = process.env.LOCAL_STORAGE_PATH || process.env.UPLOAD_DIR;
  const root = configured
    ? path.isAbsolute(configured)
      ? configured
      : path.resolve(process.cwd(), configured)
    : path.resolve(process.cwd(), "public");
  return path.join(root, "typing-game");
}

/** Resolve + validate a key to an absolute path under the storage base. Throws on invalid/traversal keys. */
export function resolveAssetPath(key: string): { absolutePath: string; prefix: R2Prefix } {
  const valid = parseR2Key(key);
  const prefix = valid.split("/")[0] as R2Prefix;
  const base = storageBase();
  const absolutePath = path.resolve(base, valid);
  if (!absolutePath.startsWith(base + path.sep)) {
    throw new Error("Refusing to resolve a key outside the storage base");
  }
  return { absolutePath, prefix };
}

/** Write a PRIVATE asset (avatars) to local disk. Throws for non-signable (i.e. non-private) keys. */
export async function writePrivateAsset(key: string, data: Buffer): Promise<void> {
  if (!isSignable(key)) {
    throw new Error(`Refusing to write public asset "${key}" through the private-asset path`);
  }
  const { absolutePath } = resolveAssetPath(key);
  fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
  fs.writeFileSync(absolutePath, data);
}

/** Read a PRIVATE asset back off local disk. Returns null when missing. Throws for non-signable keys. */
export async function readPrivateAsset(key: string): Promise<Buffer | null> {
  if (!isSignable(key)) {
    throw new Error(`Refusing to read public asset "${key}" through the private-asset path`);
  }
  const { absolutePath } = resolveAssetPath(key);
  if (!fs.existsSync(absolutePath)) return null;
  return fs.readFileSync(absolutePath);
}

const IMAGE_MIME: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  gif: "image/gif",
  svg: "image/svg+xml",
};

export function mimeTypeFor(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_MIME[ext] ?? "application/octet-stream";
}
