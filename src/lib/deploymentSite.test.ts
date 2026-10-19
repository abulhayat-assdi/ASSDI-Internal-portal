import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readFile, readdir, rm } from "fs/promises";
import os from "os";
import path from "path";
import JSZip from "jszip";
import { DeploymentError, buildLiveUrl, extractZipSite, withLiveUrl } from "./deploymentSite";

async function makeZip(entries: Record<string, string>, streamFiles = false): Promise<Buffer> {
    const zip = new JSZip();
    for (const [name, content] of Object.entries(entries)) zip.file(name, content);
    return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", streamFiles });
}

describe("extractZipSite", () => {
    let dir: string;
    beforeEach(async () => { dir = await mkdtemp(path.join(os.tmpdir(), "deploy-test-")); });
    afterEach(async () => { await rm(dir, { recursive: true, force: true }); });

    it("extracts a root-level site", async () => {
        await extractZipSite(await makeZip({ "index.html": "<html>hi</html>", "css/a.css": "body{}" }), dir);
        expect(await readFile(path.join(dir, "index.html"), "utf-8")).toBe("<html>hi</html>");
        expect(await readFile(path.join(dir, "css/a.css"), "utf-8")).toBe("body{}");
    });

    it("handles archives with data descriptors (macOS / Android zips)", async () => {
        await extractZipSite(await makeZip({ "site/index.html": "<html>x</html>", "site/a.js": "1" }, true), dir);
        expect((await readdir(dir)).sort()).toEqual(["a.js", "index.html"]);
    });

    it("flattens a wrapping folder and renames Index.HTML", async () => {
        await extractZipSite(await makeZip({ "Project/Index.HTML": "<html>p</html>", "Project/img/x.txt": "x" }), dir);
        expect((await readdir(dir)).sort()).toEqual(["img", "index.html"]);
    });

    it("rejects a damaged archive with a clear message", async () => {
        await expect(extractZipSite(Buffer.from("not a zip at all"), dir)).rejects.toThrow(DeploymentError);
        await expect(extractZipSite(Buffer.from("not a zip at all"), dir)).rejects.toThrow(/damaged or not a real ZIP/);
    });

    it("rejects a ZIP without any page", async () => {
        await expect(extractZipSite(await makeZip({ "a.css": "x" }), dir)).rejects.toThrow(/no \.html file/);
    });
});

describe("live URLs", () => {
    it("uses <main domain>/site/<subdomain> and overrides stale stored URLs", () => {
        const url = buildLiveUrl("shop");
        expect(url).toMatch(/\/site\/shop$/);
        expect(withLiveUrl({ subdomain: "shop", liveUrl: "https://shop.tasm-skill.asf.bd" }).liveUrl).toBe(url);
    });
});
