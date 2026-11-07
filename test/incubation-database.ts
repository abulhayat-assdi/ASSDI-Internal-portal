import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";
/** Always creates an in-memory database. Never reads DATABASE_URL or production credentials. */
export async function startIncubationTestDatabase(
  port = 56000 + (process.pid % 5000),
  upgrade = true,
) {
  if (process.env.INCUBATION_NATIVE_TEST === "1" && upgrade) {
    // This exact, localhost-only throwaway service is created by the review command.
    // Never accept an arbitrary database URL from the caller or the portal .env.
    const baseUrl =
      "postgresql://incubation_test:incubation_test_local_only@127.0.0.1:55442/incubation_test";
    const admin = new Client({ connectionString: baseUrl });
    await admin.connect();
    const name = `incubation_run_${process.pid}_${Date.now()}`;
    await admin.query(`CREATE DATABASE "${name}"`);
    const url = `postgresql://incubation_test:incubation_test_local_only@127.0.0.1:55442/${name}?schema=public&connection_limit=4`;
    execFileSync(
      process.execPath,
      [
        path.resolve("node_modules/prisma/build/index.js"),
        "migrate",
        "deploy",
        "--schema",
        "prisma/schema.prisma",
      ],
      { stdio: "inherit", env: { ...process.env, DATABASE_URL: url } },
    );
    const native = new Client({ connectionString: url });
    await native.connect();
    const bridge = {
      exec: (sql: string) => native.query(sql),
      query: (sql: string) => native.query(sql),
    } as unknown as PGlite;
    return {
      db: bridge,
      server: null,
      url,
      stop: async () => {
        await native.end();
        await admin.query(`DROP DATABASE "${name}"`);
        await admin.end();
      },
    };
  }
  const db = await PGlite.create();
  const schema = execFileSync(
    process.execPath,
    [
      path.resolve("node_modules/prisma/build/index.js"),
      "migrate",
      "diff",
      "--from-empty",
      "--to-schema-datamodel",
      "prisma/schema.prisma",
      "--script",
    ],
    {
      encoding: "utf8",
      env: {
        ...process.env,
        DATABASE_URL: "postgresql://fixture:fixture@127.0.0.1:1/fixture",
      },
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  await db.exec(schema);
  // Remove ONLY this fixture's generated feature tables, then exercise the real checked-in migration.
  const tables = (
    await db.query<{ tablename: string }>(
      "SELECT tablename FROM pg_tables WHERE schemaname='public' AND tablename LIKE 'incubation_%'",
    )
  ).rows;
  for (const t of tables) await db.exec(`DROP TABLE "${t.tablename}" CASCADE`);
  await db.exec(
    readFileSync(
      "prisma/migrations/202611040001_business_incubation/migration.sql",
      "utf8",
    ),
  );
  if (upgrade)
    await db.exec(
      readFileSync(
        "prisma/migrations/202611060001_incubation_competitions/migration.sql",
        "utf8",
      ),
    );
  await db.exec(
    readFileSync(
      "prisma/migrations/202611070002_incubation_program_cancelled/migration.sql",
      "utf8",
    ),
  );
  await db.exec(
    readFileSync(
      "prisma/migrations/202611070003_incubation_notifications_results/migration.sql",
      "utf8",
    ),
  );
  const server = new PGLiteSocketServer({
    db,
    host: "127.0.0.1",
    port,
    maxConnections: 20,
  });
  await server.start();
  return {
    db,
    server,
    url: `postgresql://postgres:postgres@127.0.0.1:${port}/postgres?schema=public&connection_limit=1&pool_timeout=30&pgbouncer=true&statement_cache_size=0`,
    stop: async () => {
      await server.stop();
      await db.close();
    },
  };
}
