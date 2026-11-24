import { beforeAll, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("./db", () => ({ withCourseContext: vi.fn() }));

import { SignJWT } from "jose";
import { signHomeworkFileLink, submissionFilePath, verifyHomeworkFileLink } from "./homeworkFileLink";

beforeAll(() => {
    process.env.JWT_SECRET = "test-secret-for-file-links";
});

describe("homework file links", () => {
    it("round-trips a homework path", async () => {
        const token = await signHomeworkFileLink("homework/u1/report.docx");
        expect(await verifyHomeworkFileLink(token)).toBe("homework/u1/report.docx");
    });

    it("rejects tampered tokens and a session-style token signed with the plain secret", async () => {
        const token = await signHomeworkFileLink("homework/u1/report.docx");
        expect(await verifyHomeworkFileLink(token.slice(0, -2) + "xx")).toBeNull();
        const session = await new SignJWT({ p: "homework/u1/report.docx", purpose: "homework-file-view" })
            .setProtectedHeader({ alg: "HS256" })
            .setExpirationTime("1h")
            .sign(new TextEncoder().encode(process.env.JWT_SECRET!));
        expect(await verifyHomeworkFileLink(session)).toBeNull();
    });

    it("never grants paths outside homework", async () => {
        expect(await verifyHomeworkFileLink(await signHomeworkFileLink("resources/x.pdf"))).toBeNull();
        expect(await verifyHomeworkFileLink(await signHomeworkFileLink("homework/../incubation/x.pdf"))).toBeNull();
    });
});

describe("submissionFilePath", () => {
    it("accepts the stored shapes inside the student's own folder", () => {
        expect(submissionFilePath({ storagePath: "uploads/homework/u1/a.pdf" }, "u1")).toBe("homework/u1/a.pdf");
        expect(submissionFilePath({ url: "/api/file?path=uploads%2Fhomework%2Fu1%2Fa.pdf" }, "u1")).toBe("homework/u1/a.pdf");
        expect(submissionFilePath({ url: "/uploads/homework/u1/a.pdf" }, "u1")).toBe("homework/u1/a.pdf");
    });
    it("rejects another student's folder and traversal", () => {
        expect(submissionFilePath({ storagePath: "uploads/homework/u2/a.pdf" }, "u1")).toBeNull();
        expect(submissionFilePath({ storagePath: "homework/u1/../../resources/a.pdf" }, "u1")).toBeNull();
    });
});
