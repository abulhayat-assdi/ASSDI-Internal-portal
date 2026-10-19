import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdir, mkdtemp, readFile, readdir, rm } from "fs/promises";
import os from "os";
import path from "path";
import JSZip from "jszip";
import { DeploymentError, buildLiveUrl, extractZipSite, removeOrphanSiteFolders, removeSiteFolder, withLiveUrl } from "./deploymentSite";

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

    it("leaves out SVG/XML files but keeps everything else", async () => {
        const skipped = await extractZipSite(
            await makeZip({ "site/index.html": "<html></html>", "site/logo.svg": "<svg onload=alert(1)/>", "site/data.xml": "<a/>", "site/ok.png": "x" }),
            dir
        );
        expect((await readdir(dir)).sort()).toEqual(["index.html", "ok.png"]);
        expect(skipped.sort()).toEqual(["site/data.xml", "site/logo.svg"]);
    });

    it("rejects a damaged archive with a clear message", async () => {
        await expect(extractZipSite(Buffer.from("not a zip at all"), dir)).rejects.toThrow(DeploymentError);
        await expect(extractZipSite(Buffer.from("not a zip at all"), dir)).rejects.toThrow(/নষ্ট অথবা আসল ZIP নয়/);
    });

    it("rejects a ZIP without any page", async () => {
        await expect(extractZipSite(await makeZip({ "a.css": "x" }), dir)).rejects.toThrow(/কোনো \.html ফাইল নেই/);
    });
});

describe("live URLs", () => {
    it("uses <main domain>/site/<subdomain> and overrides stale stored URLs", () => {
        const url = buildLiveUrl("shop");
        expect(url).toMatch(/\/site\/shop$/);
        expect(withLiveUrl({ subdomain: "shop", liveUrl: "https://shop.tasm-skill.asf.bd" }).liveUrl).toBe(url);
    });
});

describe("orphan folder cleanup", () => {
    let storage: string;
    beforeEach(async () => {
        storage = await mkdtemp(path.join(os.tmpdir(), "deploy-storage-"));
        process.env.LOCAL_STORAGE_PATH = storage;
        for (const name of ["alive-1", "alive-2", "alive-3", "gone"]) await mkdir(path.join(storage, "student-sites", name), { recursive: true });
    });
    afterEach(async () => { await rm(storage, { recursive: true, force: true }); delete process.env.LOCAL_STORAGE_PATH; });

    it("removes only folders no deployment points at", async () => {
        const known = ["alive-1", "alive-2", "alive-3"].map((n) => path.join(storage, "student-sites", n));
        expect(await removeOrphanSiteFolders(known)).toEqual(["gone"]);
        expect((await readdir(path.join(storage, "student-sites"))).sort()).toEqual(["alive-1", "alive-2", "alive-3"]);
    });

    it("refuses to wipe everything when the row list looks wrong", async () => {
        for (let i = 0; i < 25; i++) await mkdir(path.join(storage, "student-sites", `x-${i}`), { recursive: true });
        expect(await removeOrphanSiteFolders([])).toEqual([]);
        expect((await readdir(path.join(storage, "student-sites"))).length).toBe(29);
    });

    it("removeSiteFolder never deletes outside student-sites", async () => {
        const outside = await mkdtemp(path.join(os.tmpdir(), "outside-"));
        await removeSiteFolder(outside);
        expect((await readdir(path.dirname(outside))).includes(path.basename(outside))).toBe(true);
        await rm(outside, { recursive: true, force: true });
    });
});
