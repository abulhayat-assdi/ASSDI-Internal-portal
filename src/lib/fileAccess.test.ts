import { describe, it, expect } from "vitest";
import { normalizeStoredPath, isPublicStoredPath } from "./fileAccess";

describe("normalizeStoredPath", () => {
    it("canonicalises the prefixes the various upload routes have written", () => {
        expect(normalizeStoredPath("uploads/homework/u1/a.pdf")).toBe("homework/u1/a.pdf");
        expect(normalizeStoredPath("/uploads/homework/u1/a.pdf")).toBe("homework/u1/a.pdf");
        expect(normalizeStoredPath("api/uploads/homework/u1/a.pdf")).toBe("homework/u1/a.pdf");
        expect(normalizeStoredPath("storage/private/homework/u1/a.pdf")).toBe("homework/u1/a.pdf");
        expect(normalizeStoredPath("homework/u1/a.pdf")).toBe("homework/u1/a.pdf");
    });

    it("collapses traversal instead of letting it reach an ownership check", () => {
        // The bug this guards: the old routes tested startsWith("homework/")
        // on the raw string, so a path that only *became* a homework path
        // after resolution skipped the owner check entirely.
        expect(normalizeStoredPath("resources/../homework/victim/a.pdf")).toBe(
            "homework/victim/a.pdf"
        );
        expect(normalizeStoredPath("a/b/../../homework/victim/a.pdf")).toBe(
            "homework/victim/a.pdf"
        );
    });

    it("rejects anything that escapes the storage root", () => {
        expect(normalizeStoredPath("../../etc/passwd")).toBeNull();
        expect(normalizeStoredPath("uploads/../../etc/passwd")).toBeNull();
        expect(normalizeStoredPath("..")).toBeNull();
    });

    it("normalises backslashes so Windows-style traversal is caught too", () => {
        expect(normalizeStoredPath("resources\\..\\homework\\victim\\a.pdf")).toBe(
            "homework/victim/a.pdf"
        );
        expect(normalizeStoredPath("..\\..\\etc\\passwd")).toBeNull();
    });

    it("rejects empty, root and NUL-bearing paths", () => {
        expect(normalizeStoredPath("")).toBeNull();
        expect(normalizeStoredPath("/")).toBeNull();
        expect(normalizeStoredPath(".")).toBeNull();
        // A NUL byte truncates the path at the filesystem layer.
        expect(normalizeStoredPath("images/logo.png\0.txt")).toBeNull();
    });

    it("drops query and fragment suffixes", () => {
        expect(normalizeStoredPath("images/logo.png?v=2")).toBe("images/logo.png");
        expect(normalizeStoredPath("images/logo.png#top")).toBe("images/logo.png");
    });
});

describe("isPublicStoredPath", () => {
    it("treats branding and CV template art as public", () => {
        expect(isPublicStoredPath("images/instructors/a.jpg")).toBe(true);
        expect(isPublicStoredPath("cv-templates/thumb.png")).toBe(true);
        expect(isPublicStoredPath("uploads/cv-templates/thumb.png")).toBe(true);
    });

    it("never treats student work as public", () => {
        expect(isPublicStoredPath("homework/u1/a.pdf")).toBe(false);
        expect(isPublicStoredPath("uploads/resources/notes.pdf")).toBe(false);
        expect(isPublicStoredPath("documents/routines/week.png")).toBe(false);
    });

    it("is not fooled by a public prefix appearing mid-path", () => {
        expect(isPublicStoredPath("homework/u1/images/secret.png")).toBe(false);
    });
});
