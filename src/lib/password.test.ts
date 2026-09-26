import { describe, it, expect } from "vitest";
import bcrypt from "bcryptjs";
import { PASSWORD_COST, hashPassword, verifyPassword, needsRehash } from "./password";

describe("password hashing", () => {
    it("defaults to a cost that keeps logins affordable", () => {
        // 331ms per verification at cost 12 capped this deployment at ~6
        // logins/second. Anything above 10 by default would bring that back.
        expect(PASSWORD_COST).toBe(10);
    });

    it("hashes at the configured cost", async () => {
        const hash = await hashPassword("correct horse battery staple");
        expect(bcrypt.getRounds(hash)).toBe(PASSWORD_COST);
    });

    it("verifies its own hashes", async () => {
        const hash = await hashPassword("s3cret-password");
        expect(await verifyPassword("s3cret-password", hash)).toBe(true);
        expect(await verifyPassword("wrong-password", hash)).toBe(false);
    });

    it("still verifies older, more expensive hashes", async () => {
        // The 188 imported accounts carry cost-12 hashes; they must keep
        // working until their owners next sign in.
        const legacy = bcrypt.hashSync("legacy-password", 12);
        expect(await verifyPassword("legacy-password", legacy)).toBe(true);
    });
});

describe("needsRehash", () => {
    it("flags a hash made at a different cost", () => {
        expect(needsRehash(bcrypt.hashSync("x", 12))).toBe(true);
        expect(needsRehash(bcrypt.hashSync("x", 8))).toBe(true);
    });

    it("leaves a hash already at the configured cost alone", () => {
        expect(needsRehash(bcrypt.hashSync("x", PASSWORD_COST))).toBe(false);
    });

    it("does not touch values it cannot read as bcrypt", () => {
        // A malformed or foreign hash must not trigger a rewrite on login.
        expect(needsRehash("not-a-bcrypt-hash")).toBe(false);
        expect(needsRehash("")).toBe(false);
    });
});
