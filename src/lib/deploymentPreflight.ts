// ============================================================
// deploymentPreflight.ts — checks a picked file in the browser before it is
// uploaded, so a broken ZIP or a non-HTML file is reported instantly instead
// of after a long upload. The server runs the same rules again.
// ============================================================

import {
    MAX_ZIP_ENTRIES,
    fileSizeProblem,
    fileTypeProblem,
    htmlContentProblem,
    resolveZipLayout,
    uploadKind,
    type ZipEntryInfo,
} from "./deploymentRules";

export interface PreflightResult {
    error: string | null;
    /** Short note about what will be deployed, e.g. which page becomes the homepage. */
    note?: string;
}

export async function preflightDeployFile(file: File): Promise<PreflightResult> {
    const typeError = fileTypeProblem(file.name);
    if (typeError) return { error: typeError };
    const sizeError = fileSizeProblem(file.size);
    if (sizeError) return { error: sizeError };

    if (uploadKind(file.name) === "html") {
        const bytes = new Uint8Array(await file.arrayBuffer());
        return { error: htmlContentProblem(bytes) };
    }

    let entries: ZipEntryInfo[];
    try {
        const JSZip = (await import("jszip")).default;
        const zip = await JSZip.loadAsync(file);
        entries = Object.values(zip.files).map((f) => ({ path: f.name, isDirectory: f.dir }));
    } catch (err) {
        const msg = err instanceof Error ? err.message.toLowerCase() : "";
        if (msg.includes("encrypt")) return { error: "This ZIP is password-protected. Create it again without a password." };
        return {
            error: "This ZIP file is damaged or not a real ZIP archive. Re-create it (right-click the folder → Compress / Send to → Compressed (zipped) folder) and upload again.",
        };
    }

    if (entries.length > MAX_ZIP_ENTRIES) {
        return { error: `The ZIP has ${entries.length} files — the maximum is ${MAX_ZIP_ENTRIES}. Remove node_modules, .git or other unused folders and try again.` };
    }

    const resolved = resolveZipLayout(entries);
    if ("error" in resolved) return { error: resolved.error };

    const { rootPrefix, indexPath } = resolved.layout;
    const homepage = `${rootPrefix}${indexPath}`;
    return { error: null, note: homepage === "index.html" ? undefined : `"${homepage}" will be used as the homepage.` };
}
