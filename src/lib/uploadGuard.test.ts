import { describe, it, expect } from "vitest";
import { verifyFileSignature, verifyHomeworkFile } from "./uploadGuard";

/** Builds a buffer starting with `bytes`, padded so length checks pass. */
function bytes(...values: number[]): Buffer {
    return Buffer.concat([Buffer.from(values), Buffer.alloc(32)]);
}

const PNG = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPG = bytes(0xff, 0xd8, 0xff, 0xe0);
const PDF = bytes(0x25, 0x50, 0x44, 0x46, 0x2d, 0x31);
const ZIP = bytes(0x50, 0x4b, 0x03, 0x04);
const OLE2 = bytes(0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1);
const WEBP = bytes(0x52, 0x49, 0x46, 0x46, 0x24, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50);
const HTML = Buffer.from("<html><script>alert(1)</script></html>");

describe("verifyFileSignature", () => {
    it("accepts files whose bytes match their extension", () => {
        expect(verifyFileSignature(PNG, "photo.png")).toBeNull();
        expect(verifyFileSignature(JPG, "photo.jpg")).toBeNull();
        expect(verifyFileSignature(JPG, "photo.JPEG")).toBeNull();
        expect(verifyFileSignature(PDF, "notes.pdf")).toBeNull();
        expect(verifyFileSignature(WEBP, "img.webp")).toBeNull();
    });

    it("accepts every OOXML format, which are all ZIP containers", () => {
        expect(verifyFileSignature(ZIP, "report.docx")).toBeNull();
        expect(verifyFileSignature(ZIP, "sheet.xlsx")).toBeNull();
        expect(verifyFileSignature(ZIP, "deck.pptx")).toBeNull();
        expect(verifyFileSignature(ZIP, "archive.zip")).toBeNull();
    });

    it("accepts legacy Office files in either OLE2 or ZIP form", () => {
        expect(verifyFileSignature(OLE2, "old.doc")).toBeNull();
        expect(verifyFileSignature(ZIP, "old.doc")).toBeNull();
    });

    it("rejects content that does not match the claimed extension", () => {
        // The attack this exists for: HTML renamed to an image extension.
        expect(verifyFileSignature(HTML, "payload.png")).toMatch(/do not match/);
        expect(verifyFileSignature(HTML, "payload.jpg")).toMatch(/do not match/);
        expect(verifyFileSignature(PNG, "payload.pdf")).toMatch(/do not match/);
        expect(verifyFileSignature(ZIP, "payload.png")).toMatch(/do not match/);
    });

    it("rejects extensions it has no signature for, including none at all", () => {
        expect(verifyFileSignature(HTML, "payload.html")).toMatch(/not allowed/);
        expect(verifyFileSignature(HTML, "payload.svg")).toMatch(/not allowed/);
        expect(verifyFileSignature(HTML, "payload")).toMatch(/not allowed/);
    });

    it("lets plain-text formats through, having nothing to match on", () => {
        expect(verifyFileSignature(Buffer.from("a,b,c\n1,2,3"), "data.csv")).toBeNull();
        expect(verifyFileSignature(Buffer.from("hello"), "note.txt")).toBeNull();
    });

    it("does not read past the end of a short buffer", () => {
        expect(verifyFileSignature(Buffer.alloc(0), "empty.png")).toMatch(/do not match/);
        expect(verifyFileSignature(Buffer.from([0x89]), "truncated.png")).toMatch(/do not match/);
    });
});

describe("verifyHomeworkFile", () => {
    const page = (body: string) => Buffer.from(`<!doctype html><html><body>${body}</body></html>`);

    it("accepts an ordinary landing page, scripts and all", () => {
        const html = page(`<h1>Hi</h1><script>document.title = "x"; fetch("/a");</script><style>a{color:red}</style>`);
        expect(verifyHomeworkFile(html, "index.html")).toBeNull();
        expect(verifyHomeworkFile(html, "INDEX.HTM")).toBeNull();
    });

    it("accepts pages that merely talk about SQL, and apostrophes in prose", () => {
        expect(verifyHomeworkFile(page("<p>Learn SELECT and UPDATE in SQL. It's easy, don't worry.</p>"), "a.html")).toBeNull();
        expect(verifyHomeworkFile(page("<!-- note -->\n<p>Tom's page -- done</p>"), "a.html")).toBeNull();
    });

    it("accepts a real svg and rejects non-svg content under .svg", () => {
        expect(verifyHomeworkFile(Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><rect/></svg>'), "a.svg")).toBeNull();
        expect(verifyHomeworkFile(Buffer.from("just text"), "a.svg")).toMatch(/do not match/);
    });

    it("rejects binary data wearing an .html extension, and empty files", () => {
        expect(verifyHomeworkFile(PNG, "a.html")).toMatch(/do not match/);
        expect(verifyHomeworkFile(Buffer.alloc(0), "a.html")).toMatch(/খালি/);
    });

    it("flags SQL injection payloads with the offending line", () => {
        const cases = [
            `<a href="/u?id=1' OR '1'='1">x</a>`,
            `<a href="/u?id=1 UNION SELECT password FROM users">x</a>`,
            `<input value="x'; DROP TABLE users; --">`,
            `<a href="/u?q=1; DELETE FROM users">x</a>`,
            `<a href="/u?q=1 AND SLEEP(5)">x</a>`,
        ];
        for (const c of cases) {
            const err = verifyHomeworkFile(page(`<p>ok</p>\n${c}`), "a.html");
            expect(err, c).toMatch(/SQL ইনজেকশন/);
            expect(err, c).toMatch(/লাইন 2/);
        }
    });

    it("falls back to the signature check for other formats", () => {
        expect(verifyHomeworkFile(PNG, "a.png")).toBeNull();
        expect(verifyHomeworkFile(HTML, "a.png")).toMatch(/do not match/);
        expect(verifyHomeworkFile(HTML, "a.exe")).toMatch(/not allowed/);
    });
});
