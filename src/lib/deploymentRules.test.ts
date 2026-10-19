import { describe, expect, it } from "vitest";
import {
    buildSiteUrl,
    decodeHtmlBytes,
    fileSizeProblem,
    fileTypeProblem,
    htmlContentProblem,
    resolveZipLayout,
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
        expect(subdomainProblem("")).toMatch(/required/);
        expect(subdomainProblem("ab")).toMatch(/at least 3/);
        expect(subdomainProblem("my site")).toMatch(/no spaces/);
        expect(subdomainProblem("my.site")).toMatch(/no spaces, dots/);
        expect(subdomainProblem("-site")).toMatch(/start or end with a hyphen/);
        expect(subdomainProblem("admin")).toMatch(/reserved/);
        expect(subdomainProblem("a".repeat(64))).toMatch(/at most 63/);
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
        expect(fileTypeProblem("site.rar")).toMatch(/Only \.zip/);
        expect(fileTypeProblem("photo.png")).toMatch(/not supported/);
    });

    it("rejects empty and oversized files", () => {
        expect(fileSizeProblem(0)).toMatch(/empty/);
        expect(fileSizeProblem(51 * 1024 * 1024)).toMatch(/maximum is 50MB/);
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
        expect(htmlContentProblem(enc("PK\u0003\u0004rest"))).toMatch(/actually a ZIP/);
        expect(htmlContentProblem(enc("   "))).toMatch(/empty/);
        expect(htmlContentProblem(enc("just some text"))).toMatch(/doesn't contain any HTML tags/);
        expect(htmlContentProblem(new Uint8Array([0x3c, 0x68, 0x00, 0x01]))).toMatch(/binary/);
    });
});

describe("resolveZipLayout", () => {
    it("uses index.html at the root", () => {
        expect(resolveZipLayout(files("index.html", "style.css"))).toEqual({ layout: { rootPrefix: "", indexPath: "index.html" } });
    });

    it("flattens a single wrapping folder", () => {
        expect(resolveZipLayout(files("my-site/", "my-site/index.html", "my-site/css/a.css"))).toEqual({
            layout: { rootPrefix: "my-site/", indexPath: "index.html" },
        });
    });

    it("accepts Index.HTML from Windows", () => {
        expect(resolveZipLayout(files("Index.HTML", "a.png"))).toEqual({ layout: { rootPrefix: "", indexPath: "Index.HTML" } });
    });

    it("ignores macOS junk", () => {
        expect(resolveZipLayout(files("__MACOSX/site/._index.html", "site/index.html", "site/.DS_Store"))).toEqual({
            layout: { rootPrefix: "site/", indexPath: "index.html" },
        });
    });

    it("uses the only HTML page when there is no index.html", () => {
        expect(resolveZipLayout(files("landing.html", "img/a.png"))).toEqual({ layout: { rootPrefix: "", indexPath: "landing.html" } });
    });

    it("prefers the shallowest index over nested ones", () => {
        expect(resolveZipLayout(files("index.html", "blog/index.html"))).toEqual({ layout: { rootPrefix: "", indexPath: "index.html" } });
    });

    it("explains what is wrong otherwise", () => {
        expect(resolveZipLayout(files())).toEqual({ error: expect.stringMatching(/empty/) });
        expect(resolveZipLayout(files("a.css", "b.png"))).toEqual({ error: expect.stringMatching(/no \.html file/) });
        expect(resolveZipLayout(files("a.html", "b.html"))).toEqual({ error: expect.stringMatching(/rename your main page to index\.html/) });
        expect(resolveZipLayout(files("one/index.html", "two/index.html"))).toEqual({ error: expect.stringMatching(/more than one site/) });
    });
});
