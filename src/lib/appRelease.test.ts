import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const files = vi.hoisted(() => ({ manifest: "" as string | null, apkSize: 1000 as number | null }));
vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(async () => {
    if (files.manifest === null) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    return files.manifest;
  }),
  stat: vi.fn(async () => {
    if (files.apkSize === null) throw Object.assign(new Error("missing"), { code: "ENOENT" });
    return { isFile: () => true, size: files.apkSize };
  }),
}));

import { apkDownloadPath, readAppRelease } from "./appRelease";

const sha = "a".repeat(64);
const manifest = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    versionCode: 2,
    versionName: "1.1.0",
    minVersionCode: 1,
    sha256: sha,
    size: 1000,
    notes: ["note"],
    publishedAt: "2026-11-08T10:00:00Z",
    apk: "/downloads/asm-portal.apk",
    ...over,
  });

describe("readAppRelease", () => {
  beforeEach(() => {
    files.manifest = manifest();
    files.apkSize = 1000;
  });

  it("reads a valid manifest", async () => {
    const r = await readAppRelease();
    expect(r).toMatchObject({ versionCode: 2, versionName: "1.1.0", minVersionCode: 1, notes: ["note"] });
  });

  it("never advertises a minimum above the published version", async () => {
    files.manifest = manifest({ minVersionCode: 9 });
    expect((await readAppRelease())?.minVersionCode).toBe(2);
  });

  it("returns null when the manifest is malformed", async () => {
    files.manifest = manifest({ sha256: "not-a-hash" });
    expect(await readAppRelease()).toBeNull();
    files.manifest = "{oops";
    expect(await readAppRelease()).toBeNull();
  });

  it("returns null when the APK or manifest is missing", async () => {
    files.apkSize = null;
    expect(await readAppRelease()).toBeNull();
    files.apkSize = 1000;
    files.manifest = null;
    expect(await readAppRelease()).toBeNull();
  });

  it("returns null for an empty APK", async () => {
    files.apkSize = 0;
    expect(await readAppRelease()).toBeNull();
  });
});

describe("apkDownloadPath", () => {
  it("adds the version as a cache buster", () => {
    expect(apkDownloadPath({ apk: "/downloads/asm-portal.apk", versionCode: 3 })).toBe(
      "/downloads/asm-portal.apk?v=3",
    );
  });
});
