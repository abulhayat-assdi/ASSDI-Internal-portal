import { it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { startIncubationTestDatabase } from "../../../test/incubation-database";
it("upgrades populated legacy programs without replacing their operational records", async () => {
  const f = await startIncubationTestDatabase(undefined, false);
  try {
    await f.db.exec(
      "INSERT INTO courses(id,slug,name,updated_at) VALUES('legacy-course','legacy','Legacy course',now()); INSERT INTO incubation_programs(id,course_id,name,start_date,batch_names,staff_ids,settings,created_by,updated_at) VALUES('legacy-program','legacy-course','Existing Market Lab','2026-11-01','[\"Batch 1\"]','[]','{}','legacy-admin',now()); INSERT INTO incubation_teams(id,course_id,program_id,name,batch_name) VALUES('legacy-team','legacy-course','legacy-program','Existing Team','Batch 1'); INSERT INTO incubation_records(id,course_id,program_id,team_id,kind,date,status,data,request_key,request_hash,entered_by,entered_by_name,updated_at) VALUES('legacy-fund','legacy-course','legacy-program','legacy-team','fund','2026-11-01','posted','{\"amount\":\"5000\"}','legacy-request','legacy-hash','legacy-admin','Legacy Admin',now());",
    );
    await f.db.exec(
      readFileSync(
        "prisma/migrations/202611060001_incubation_competitions/migration.sql",
        "utf8",
      ),
    );
    const p = (
      await f.db.query<{ id: string; competition_id: string }>(
        "SELECT id,competition_id FROM incubation_programs",
      )
    ).rows;
    expect(p).toHaveLength(1);
    expect(p[0].id).toBe("legacy-program");
    expect(p[0].competition_id).toBeTruthy();
    const c = (
      await f.db.query<{
        kind: string;
        title: string;
        batch_name: string | null;
      }>("SELECT kind,title,batch_name FROM competitions")
    ).rows;
    expect(c).toEqual([
      {
        kind: "business_incubation",
        title: "Existing Market Lab",
        batch_name: null,
      },
    ]);
    expect(
      (
        await f.db.query<{ id: string; data: any }>(
          "SELECT id,data FROM incubation_records",
        )
      ).rows,
    ).toEqual([{ id: "legacy-fund", data: { amount: "5000" } }]);
  } finally {
    await f.stop();
  }
}, 30000);
