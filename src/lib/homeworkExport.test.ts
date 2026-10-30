import { afterEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import * as XLSX from "xlsx";
import type { HomeworkFile, HomeworkSubmission } from "@/services/homeworkService";
import {
    createHomeworkWorkbook, createHomeworkZip, formatHomeworkSubmittedAt,
    getHomeworkFiles, homeworkFileDownloadUrl, MAX_HOMEWORK_ZIP_BYTES, safeHomeworkName,
} from "./homeworkExport";

const submission = (overrides: Partial<HomeworkSubmission> = {}): HomeworkSubmission => ({
    id: "submission-1", studentUid: "student-1", studentName: "রহিম", studentRoll: "001",
    studentBatchName: "Batch 12", teacherName: "Teacher", subject: "Office assignment",
    submissionDate: "2026-10-30", submittedAt: "2026-10-29T20:15:00.000Z",
    textContent: "বাংলা উত্তর\nhttps://example.test/work", ...overrides,
});
const attachment = (fileName: string, storagePath = `uploads/homework/student-1/${fileName}`): HomeworkFile => ({
    fileName, storagePath, url: `/${storagePath}`,
});
const fetchMock = (body: BodyInit = "dummy file bytes", init?: ResponseInit) => {
    const mock = vi.fn().mockImplementation(async () => new Response(body, init));
    vi.stubGlobal("fetch", mock);
    return mock;
};
const unpack = async (blob: Blob) => JSZip.loadAsync(await blob.arrayBuffer(), { checkCRC32: true });
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("homework downloads", () => {
    it("preserves the existing Excel columns, Bengali, leading-zero rolls, dates and literal formula-like text", async () => {
        const workbook = await createHomeworkWorkbook([submission({ textContent: "=HYPERLINK(\"bad\")", files: [attachment("a.pdf")] })]);
        const roundTrip = XLSX.read(XLSX.write(workbook, { type: "array", bookType: "xlsx" }));
        const sheet = roundTrip.Sheets.Submissions;
        const rows = XLSX.utils.sheet_to_json<string[]>(sheet, { header: 1 });
        expect(rows[0]).toEqual(["SL", "Student Name", "Roll Number", "Batch Name", "Submitted At", "Text / Link", "Uploaded Files"]);
        expect(rows[1][1]).toBe("রহিম");
        expect(sheet.C2).toMatchObject({ t: "s", v: "001" });
        expect(sheet.F2).toMatchObject({ t: "s", v: "=HYPERLINK(\"bad\")" });
        expect(sheet.F2.f).toBeUndefined();
        expect(rows[1][4]).toContain("30 Oct 2026");
        expect(rows[1][4]).toContain("02:15");
        expect(rows[1][6]).toBe("1 file(s) uploaded");
    });

    it("packs mixed file types byte-for-byte, multiple students, repeated filenames and an Excel index", async () => {
        const names = ["photo.png", "video.mp4", "report.docx", "marks.xlsx", "slides.pptx", "answer.pdf", "answer.pdf"];
        const files = names.map((name, index) => attachment(name, `uploads/homework/student-1/${index}_${name}`));
        const payloads = files.map((_, i) => new Uint8Array([0, 255, i, 12, 34, 128]));
        const responses = new Map(files.map((file, i) => [homeworkFileDownloadUrl(file, "student-1"), payloads[i]]));
        const mock = vi.fn(async (url: string) => new Response(responses.get(url)));
        vi.stubGlobal("fetch", mock);
        const onProgress = vi.fn();
        const zip = await unpack(await createHomeworkZip([
            submission({ files }),
            submission({ id: "submission-2", files: [], textContent: "শুধু লেখা" }),
        ], { onProgress }));
        const stored = Object.values(zip.files).filter(file => !file.dir && file.name.includes("/files/"));
        expect(stored).toHaveLength(names.length);
        for (let i = 0; i < stored.length; i++) expect(await stored[i].async("uint8array")).toEqual(payloads[i]);
        expect(stored.map(file => file.name)).toEqual(names.map((name, i) => `submissions/001_001_রহিম/files/00${i + 1}_${name}`));
        expect(await zip.file("submissions/002_001_রহিম/submission.txt")!.async("string")).toContain("শুধু লেখা");
        const workbook = XLSX.read(await zip.file("submissions.xlsx")!.async("uint8array"));
        const rows = XLSX.utils.sheet_to_json<string[]>(workbook.Sheets.Submissions, { header: 1 });
        expect(rows).toHaveLength(3);
        expect(rows[0][7]).toBe("Files Folder");
        expect(rows[1][7]).toBe("submissions/001_001_রহিম");
        expect(rows[2][7]).toBe("submissions/002_001_রহিম");
        expect(mock).toHaveBeenCalledTimes(7);
        expect(mock).toHaveBeenCalledWith(expect.any(String), expect.objectContaining({ credentials: "same-origin", redirect: "error", cache: "no-store" }));
        expect(onProgress).toHaveBeenCalledWith("Downloading files 7/7...");
        expect(onProgress).toHaveBeenLastCalledWith("Creating ZIP 100%...");
    });

    it("keeps full text in submission.txt when Excel reaches its cell limit", async () => {
        const mock = fetchMock();
        const text = "ক".repeat(40000);
        const zip = await unpack(await createHomeworkZip([submission({ textContent: text })]));
        expect(mock).not.toHaveBeenCalled();
        expect(await zip.file("submissions/001_001_রহিম/submission.txt")!.async("string")).toContain(text);
        const workbook = XLSX.read(await zip.file("submissions.xlsx")!.async("uint8array"));
        expect(workbook.Sheets.Submissions.F2.v).toHaveLength(32767);
    });

    it("exports only the supplied filtered list, including legacy single-file records", async () => {
        const mock = fetchMock("legacy bytes");
        const hw = submission({ files: [], fileName: "old.pdf", fileUrl: "/storage/private/homework/student-1/old.pdf" });
        const zip = await unpack(await createHomeworkZip([hw]));
        expect(getHomeworkFiles(hw)).toHaveLength(1);
        expect(mock).toHaveBeenCalledTimes(1);
        expect(await zip.file("submissions/001_001_রহিম/files/001_old.pdf")!.async("string")).toBe("legacy bytes");
        expect(mock.mock.calls[0][0]).toBe("/api/file?path=homework%2Fstudent-1%2Fold.pdf");
    });

    it.each([401, 403, 404, 500])("fails the entire export on HTTP %i instead of silently omitting an attachment", async status => {
        const mock = vi.fn()
            .mockResolvedValueOnce(new Response("first file"))
            .mockResolvedValueOnce(new Response("error", { status }));
        vi.stubGlobal("fetch", mock);
        await expect(createHomeworkZip([submission({ files: [attachment("good.pdf"), attachment("missing.pdf"), attachment("last.pdf")] })]))
            .rejects.toThrow(/রহিম \(roll 001\), missing.pdf:.*No ZIP was downloaded/);
        expect(mock).toHaveBeenCalledTimes(2);
    });

    it("does not archive a sign-in page returned as HTTP 200", async () => {
        fetchMock("<html>Login</html>", { headers: { "content-type": "text/html" } });
        await expect(createHomeworkZip([submission({ files: [attachment("answer.pdf")] })])).rejects.toThrow("sign-in page");
    });

    it("preserves intentionally uploaded sandboxed HTML documents", async () => {
        const html = "<!doctype html><h1>Homework</h1>";
        fetchMock(html, { headers: { "content-type": "text/html", "content-security-policy": "sandbox allow-scripts" } });
        const zip = await unpack(await createHomeworkZip([submission({ files: [attachment("index.html")] })]));
        expect(await zip.file("submissions/001_001_রহিম/files/001_index.html")!.async("string")).toBe(html);
    });

    it("reports a network failure without producing an archive", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
        await expect(createHomeworkZip([submission({ files: [attachment("answer.pdf")] })])).rejects.toThrow("Failed to fetch");
    });

    it("rejects an oversized selection before downloading files", async () => {
        const mock = fetchMock();
        await expect(createHomeworkZip([submission({ files: [{ ...attachment("video.mp4"), size: MAX_HOMEWORK_ZIP_BYTES + 1 }] })])).rejects.toThrow("250 MB");
        expect(mock).not.toHaveBeenCalled();
    });

    it("checks the real response size even when old records have no size metadata", async () => {
        fetchMock("small body", { headers: { "content-length": String(MAX_HOMEWORK_ZIP_BYTES + 1) } });
        await expect(createHomeworkZip([submission({ files: [attachment("video.mp4")] })])).rejects.toThrow("250 MB");
    });

    it("stops chunked downloads when they exceed the size limit without a Content-Length header", async () => {
        const chunk = new Uint8Array(8 * 1024 * 1024);
        const cancel = vi.fn();
        const stream = new ReadableStream({ pull(controller) { controller.enqueue(chunk); }, cancel });
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(stream)));
        await expect(createHomeworkZip([submission({ files: [attachment("video.mp4")] })])).rejects.toThrow("250 MB");
        expect(cancel).toHaveBeenCalled();
    });

    it("cancels before starting and during attachment downloads", async () => {
        const controller = new AbortController();
        controller.abort();
        const mock = fetchMock();
        await expect(createHomeworkZip([submission()], { signal: controller.signal })).rejects.toMatchObject({ name: "AbortError" });
        expect(mock).not.toHaveBeenCalled();
        const active = new AbortController();
        mock.mockImplementation(async () => { active.abort(); return new Response("bytes"); });
        await expect(createHomeworkZip([submission({ files: [attachment("file.pdf")] })], { signal: active.signal })).rejects.toMatchObject({ name: "AbortError" });
    });

    it("rejects an empty selection", async () => {
        await expect(createHomeworkZip([])).rejects.toThrow("no submissions");
    });
});

describe("safe file paths", () => {
    it.each([
        "uploads/homework/student-1/a.pdf", "/homework/student-1/a.pdf",
        "/api/uploads/homework/student-1/a.pdf", "/storage/private/homework/student-1/a.pdf",
    ])("normalizes supported stored path %s", storagePath => {
        expect(homeworkFileDownloadUrl(attachment("a.pdf", storagePath), "student-1")).toBe("/api/file?path=homework%2Fstudent-1%2Fa.pdf");
    });
    it("uses legacy /api/file URLs and prefers storagePath over the URL", () => {
        expect(homeworkFileDownloadUrl({ fileName: "a.pdf", storagePath: "", url: "/api/file?path=uploads%2Fhomework%2Fstudent-1%2Fa.pdf" }, "student-1"))
            .toBe("/api/file?path=homework%2Fstudent-1%2Fa.pdf");
        expect(homeworkFileDownloadUrl({ ...attachment("a.pdf"), url: "https://external.test/file" }, "student-1"))
            .toBe("/api/file?path=homework%2Fstudent-1%2Fa.pdf");
    });
    it.each([
        "uploads/homework/student-2/a.pdf", "uploads/homework/student-1/../student-2/a.pdf",
        "../../etc/passwd", "uploads/resources/a.pdf", "homework/student-1/", "homework/student-1/a\u0000.pdf",
    ])("rejects another owner, traversal and non-homework path %s", storagePath => {
        expect(() => homeworkFileDownloadUrl(attachment("a.pdf", storagePath), "student-1")).toThrow("invalid storage");
    });
    it("rejects external URLs without making network requests", () => {
        expect(() => homeworkFileDownloadUrl({ fileName: "a.pdf", storagePath: "", url: "https://external.test/a.pdf" }, "student-1"))
            .toThrow("not stored on this portal");
    });
    it("makes portable filenames without destroying Bengali names", () => {
        expect(safeHomeworkName("ছবি.png")).toBe("ছবি.png");
        expect(safeHomeworkName("../../bad\\name?.pdf")).not.toMatch(/[\\/?]/);
        expect(safeHomeworkName("CON.txt")).toBe("_CON.txt");
        expect(safeHomeworkName("... ")).toBe("homework");
        expect(safeHomeworkName("a".repeat(200))).toHaveLength(100);
        expect(safeHomeworkName("ক".repeat(200) + ".docx")).toBe("ক".repeat(95) + ".docx");
        expect(formatHomeworkSubmittedAt(submission({ submittedAt: "invalid" }))).toBe("2026-10-30");
    });
});
