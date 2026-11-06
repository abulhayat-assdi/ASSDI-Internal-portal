import { describe, it, expect, vi } from "vitest";
import { failure } from "./http";
describe("Live Chat setup diagnostics", () => {
  it.each(["P2021", "P2022", "P1010"])(
    "explains incomplete schema or grants (%s)",
    async (code) => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const r = failure({ code });
        expect(r.status).toBe(503);
        expect((await r.json()).code).toBe("CHAT_DATABASE_SETUP_REQUIRED");
      } finally {
        spy.mockRestore();
      }
    },
  );
  it("classifies PostgreSQL permission and missing-column errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      for (const code of ["42501", "42703", "42P01"])
        expect(
          (await failure({ code: "P2010", meta: { code } }).json()).code,
        ).toBe("CHAT_DATABASE_SETUP_REQUIRED");
    } finally {
      spy.mockRestore();
    }
  });
  it("does not disclose connection strings in unknown errors", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      const r = failure(Error("postgresql://secret@private/database"));
      expect(JSON.stringify(await r.json())).not.toContain("secret");
      expect(JSON.stringify(spy.mock.calls)).not.toContain("secret");
    } finally {
      spy.mockRestore();
    }
  });
});
