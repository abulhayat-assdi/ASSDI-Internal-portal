// ============================================================
// deploymentPreflight.ts — browser-side helpers for the deploy form:
//  - checks a picked file before upload, so a broken ZIP or a non-HTML file
//    is reported instantly instead of after a long upload (the server runs
//    the same rules again);
//  - turns a dropped/selected folder into a ZIP, so students don't have to
//    make one themselves;
//  - builds a sample project ZIP for the guide.
// ============================================================

import {
    MAX_DEPLOY_SIZE_MB,
    MAX_ZIP_ENTRIES,
    blockedFilesNote,
    fileSizeProblem,
    fileTypeProblem,
    formatBytes,
    htmlContentProblem,
    isJunkZipPath,
    resolveZipLayout,
    uploadKind,
    type ZipEntryInfo,
} from "./deploymentRules";

export interface PreflightResult {
    error: string | null;
    /** Notes about what will be deployed, e.g. which page becomes the homepage. */
    notes: string[];
}

async function loadJSZip() {
    return (await import("jszip")).default;
}

export async function preflightDeployFile(file: File): Promise<PreflightResult> {
    const typeError = fileTypeProblem(file.name);
    if (typeError) return { error: typeError, notes: [] };
    const sizeError = fileSizeProblem(file.size);
    if (sizeError) return { error: sizeError, notes: [] };

    if (uploadKind(file.name) === "html") {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return { error: htmlContentProblem(bytes), notes: [] };
    }

    let entries: ZipEntryInfo[];
    try {
        const JSZip = await loadJSZip();
        const zip = await JSZip.loadAsync(file);
        entries = Object.values(zip.files).map((f) => ({ path: f.name, isDirectory: f.dir }));
    } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (msg.includes("encrypt")) return { error: "ZIP ফাইলটিতে পাসওয়ার্ড দেওয়া আছে। পাসওয়ার্ড ছাড়া আবার zip করুন।", notes: [] };
        return {
            error: "ZIP ফাইলটি নষ্ট অথবা আসল ZIP নয়। ফোল্ডারে রাইট-ক্লিক করে Compress / Send to → Compressed (zipped) folder দিয়ে আবার zip করুন — অথবা পুরো ফোল্ডারটাই এখানে টেনে আনুন।",
            notes: [],
        };
    }

    if (entries.length > MAX_ZIP_ENTRIES) {
        return { error: `ZIP-এ ${entries.length}টি ফাইল আছে — সর্বোচ্চ ${MAX_ZIP_ENTRIES}টি দেওয়া যাবে। node_modules, .git বা অপ্রয়োজনীয় ফোল্ডার বাদ দিয়ে আবার চেষ্টা করুন।`, notes: [] };
    }

    const resolved = resolveZipLayout(entries);
    if ("error" in resolved) return { error: resolved.error, notes: [] };

    const { rootPrefix, indexPath, blockedFiles } = resolved.layout;
    const notes: string[] = [];
    const homepage = `${rootPrefix}${indexPath}`;
    if (homepage !== "index.html") notes.push(`"${homepage}" হোমপেজ হিসেবে ব্যবহার হবে।`);
    const blocked = blockedFilesNote(blockedFiles);
    if (blocked) notes.push(blocked);
    return { error: null, notes };
}

// ─── Folder → ZIP ─────────────────────────────────────────────────────────────

export interface PickedFile {
    file: File;
    /** Path relative to the picked folder's parent, e.g. "my-site/css/a.css". */
    path: string;
}

/** Folders that are never part of a static site and only bloat the upload. */
function isSkippedFolderPath(p: string): boolean {
    return isJunkZipPath(p) || p.split("/").some((part) => part === "node_modules" || part === ".git" || part === ".vscode" || part === ".idea");
}

/** Zips a folder the student picked or dropped. Throws an Error with a Bengali message on problems. */
export async function zipFolder(files: PickedFile[], folderName: string): Promise<File> {
    const kept = files.filter((f) => !isSkippedFolderPath(f.path));
    if (kept.length === 0) throw new Error("ফোল্ডারটি খালি।");
    if (kept.length > MAX_ZIP_ENTRIES) {
        throw new Error(`ফোল্ডারে ${kept.length}টি ফাইল আছে — সর্বোচ্চ ${MAX_ZIP_ENTRIES}টি দেওয়া যাবে। অপ্রয়োজনীয় ফাইল বাদ দিন।`);
    }
    const total = kept.reduce((sum, f) => sum + f.file.size, 0);
    if (total > MAX_DEPLOY_SIZE_MB * 1024 * 1024) {
        throw new Error(`ফোল্ডারের মোট সাইজ ${formatBytes(total)} — সর্বোচ্চ ${MAX_DEPLOY_SIZE_MB}MB দেওয়া যাবে। ছবি/ভিডিও ছোট করুন।`);
    }

    const JSZip = await loadJSZip();
    const zip = new JSZip();
    for (const f of kept) zip.file(f.path, f.file);
    const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
    return new File([blob], `${folderName || "site"}.zip`, { type: "application/zip" });
}

/** Files from an <input webkitdirectory> pick. */
export function pickedFromInput(list: FileList): { files: PickedFile[]; folderName: string } {
    const files = Array.from(list).map((file) => ({ file, path: file.webkitRelativePath || file.name }));
    const folderName = files[0]?.path.split("/")[0] ?? "site";
    return { files, folderName };
}

/* Minimal typings for the (non-standard but universal) drag-and-drop entries API. */
interface FsEntry { isFile: boolean; isDirectory: boolean; name: string; fullPath: string }
interface FsFileEntry extends FsEntry { file(ok: (f: File) => void, err: (e: unknown) => void): void }
interface FsDirEntry extends FsEntry { createReader(): { readEntries(ok: (e: FsEntry[]) => void, err: (e: unknown) => void): void } }

async function walkEntry(entry: FsEntry, out: PickedFile[]): Promise<void> {
    if (entry.isFile) {
        const file = await new Promise<File>((ok, err) => (entry as FsFileEntry).file(ok, err));
        out.push({ file, path: entry.fullPath.replace(/^\/+/, "") });
        return;
    }
    if (entry.isDirectory) {
        const reader = (entry as FsDirEntry).createReader();
        // readEntries returns at most ~100 entries per call — keep reading until empty.
        for (;;) {
            const batch = await new Promise<FsEntry[]>((ok, err) => reader.readEntries(ok, err));
            if (batch.length === 0) break;
            for (const child of batch) await walkEntry(child, out);
        }
    }
}

/**
 * What was dropped: a single file, or a folder (returned as its files).
 * Returns null when nothing usable was dropped.
 */
export async function readDrop(dt: DataTransfer): Promise<{ file: File } | { files: PickedFile[]; folderName: string } | null> {
    const item = dt.items?.[0] as (DataTransferItem & { webkitGetAsEntry?: () => FsEntry | null }) | undefined;
    const entry = item?.webkitGetAsEntry?.() ?? null;
    if (entry?.isDirectory) {
        const files: PickedFile[] = [];
        await walkEntry(entry, files);
        return { files, folderName: entry.name };
    }
    const file = dt.files?.[0];
    return file ? { file } : null;
}

// ─── Sample project ───────────────────────────────────────────────────────────

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="bn">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>আমার ল্যান্ডিং পেজ</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <header class="hero">
        <img src="images/logo.png" alt="Logo" class="logo">
        <h1>আমার প্রথম ল্যান্ডিং পেজ</h1>
        <p>index.html, css আর images ফোল্ডার একসাথে একটা ফোল্ডারে রেখে ডিপ্লয় করুন।</p>
        <a href="#contact" class="btn">যোগাযোগ করুন</a>
    </header>
    <section id="contact">
        <h2>যোগাযোগ</h2>
        <p>ফোন: 01XXXXXXXXX</p>
    </section>
    <script src="js/main.js"></script>
</body>
</html>
`;

const SAMPLE_CSS = `body { margin: 0; font-family: system-ui, sans-serif; color: #1e293b; }
.hero { padding: 64px 16px; text-align: center; background: #eff6ff; }
.logo { width: 64px; height: 64px; }
.btn { display: inline-block; margin-top: 16px; padding: 12px 24px; background: #2563eb; color: #fff; border-radius: 12px; text-decoration: none; }
section { padding: 48px 16px; text-align: center; }
`;

const SAMPLE_JS = `console.log("Site loaded");\n`;

// 64×64 blue square PNG, so the sample shows the images/ folder in use.
const SAMPLE_LOGO_PNG_BASE64 =
    "iVBORw0KGgoAAAANSUhEUgAAAEAAAABACAIAAAAlC+aJAAAAT0lEQVR42u3PQQkAAAgEsCtjMuNbwgi+hcEKLNXzWgQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQELguYZjFanhwbHAAAAABJRU5ErkJggg==";

export async function makeSampleSiteZip(): Promise<Blob> {
    const JSZip = await loadJSZip();
    const zip = new JSZip();
    const root = zip.folder("my-landing-page")!;
    root.file("index.html", SAMPLE_HTML);
    root.file("css/style.css", SAMPLE_CSS);
    root.file("js/main.js", SAMPLE_JS);
    root.file("images/logo.png", SAMPLE_LOGO_PNG_BASE64, { base64: true });
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
