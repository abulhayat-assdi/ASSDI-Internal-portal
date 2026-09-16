/**
 * startup.js — runs before the Next.js server starts.
 * Applies any schema changes that aren't covered by migration files.
 * Safe to run multiple times (uses IF NOT EXISTS / idempotent SQL).
 */

const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function applySchemaPatches() {
    console.log("[startup] Applying schema patches...");

    // ── Original patches (idempotent) ──────────────────────────

    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::JSONB;
        `);
        console.log("[startup] ✓ users.permissions column OK");
    } catch (err) {
        console.error("[startup] Schema patch error (permissions):", err.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE batch_students ADD COLUMN IF NOT EXISTS photo TEXT;
        `);
        console.log("[startup] ✓ batch_students.photo column OK");
    } catch (err) {
        console.error("[startup] Schema patch error (photo):", err.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE teachers ADD COLUMN IF NOT EXISTS image_object_position TEXT DEFAULT 'center';
        `);
        console.log("[startup] ✓ teachers.image_object_position column OK");
    } catch (err) {
        console.error("[startup] Schema patch error (image_object_position):", err.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS routine_configs (
                id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
                batch TEXT NOT NULL,
                title TEXT NOT NULL DEFAULT '',
                subtitle TEXT NOT NULL DEFAULT '',
                footer_text TEXT NOT NULL DEFAULT '',
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT routine_configs_pkey PRIMARY KEY (id)
            );
        `);
        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS routine_configs_batch_key ON routine_configs(batch);
        `);
        console.log("[startup] ✓ routine_configs table OK");
    } catch (err) {
        console.error("[startup] Schema patch error (routine_configs):", err.message);
    }

    // ── Active sessions table (concurrent login tracking) ──────────
    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS active_sessions (
                id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
                user_id TEXT NOT NULL,
                expires_at TIMESTAMP(3) NOT NULL,
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT active_sessions_pkey PRIMARY KEY (id)
            );
        `);
        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS active_sessions_user_id_key ON active_sessions(user_id);
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS active_sessions_expires_at_idx ON active_sessions(expires_at);
        `);
        await prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'active_sessions_user_id_fkey'
                ) THEN
                    ALTER TABLE active_sessions
                    ADD CONSTRAINT active_sessions_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
                END IF;
            END $$;
        `);
        console.log("[startup] ✓ active_sessions table OK");
    } catch (err) {
        console.error("[startup] Schema patch error (active_sessions):", err.message);
    }

    // ── Student Leave Requests ──────────────────────────────────────
    try {
        await prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                CREATE TYPE "StudentLeaveStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');
            EXCEPTION
                WHEN duplicate_object THEN null;
            END $$;
        `);
        console.log("[startup] ✓ StudentLeaveStatus enum OK");
    } catch (err) {
        console.error("[startup] Schema patch error (StudentLeaveStatus):", err.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS student_leave_requests (
                id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
                student_uid TEXT NOT NULL,
                student_name TEXT NOT NULL,
                student_roll TEXT NOT NULL,
                student_batch_name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                reason TEXT NOT NULL,
                status "StudentLeaveStatus" NOT NULL DEFAULT 'PENDING',
                reviewed_by TEXT,
                review_note TEXT,
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT student_leave_requests_pkey PRIMARY KEY (id)
            );
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS student_leave_requests_student_uid_idx ON student_leave_requests(student_uid);
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS student_leave_requests_student_batch_name_idx ON student_leave_requests(student_batch_name);
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS student_leave_requests_status_idx ON student_leave_requests(status);
        `);
        console.log("[startup] ✓ student_leave_requests table OK");
    } catch (err) {
        console.error("[startup] Schema patch error (student_leave_requests):", err.message);
    }

    // ── Mini-Netlify Deployments ────────────────────────────────────
    try {
        await prisma.$executeRawUnsafe(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS deployment_limit INT NOT NULL DEFAULT 5;
        `);
        await prisma.$executeRawUnsafe(`
            ALTER TABLE users ADD COLUMN IF NOT EXISTS is_deployment_frozen BOOLEAN NOT NULL DEFAULT FALSE;
        `);
        console.log("[startup] ✓ users.deployment_limit & is_deployment_frozen columns OK");
    } catch (err) {
        console.error("[startup] Schema patch error (user deployment fields):", err.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS deployments (
                id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
                user_id TEXT NOT NULL,
                subdomain TEXT NOT NULL,
                display_name TEXT NOT NULL DEFAULT '',
                folder_path TEXT NOT NULL,
                live_url TEXT NOT NULL,
                total_visitors INTEGER NOT NULL DEFAULT 0,
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT deployments_pkey PRIMARY KEY (id)
            );
        `);
        await prisma.$executeRawUnsafe(`
            CREATE UNIQUE INDEX IF NOT EXISTS deployments_subdomain_key ON deployments(subdomain);
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS deployments_user_id_idx ON deployments(user_id);
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS deployments_subdomain_idx ON deployments(subdomain);
        `);
        await prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'deployments_user_id_fkey'
                ) THEN
                    ALTER TABLE deployments
                    ADD CONSTRAINT deployments_user_id_fkey
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE ON UPDATE CASCADE;
                END IF;
            END $$;
        `);
        console.log("[startup] ✓ deployments table OK");
    } catch (err) {
        console.error("[startup] Schema patch error (deployments):", err.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            CREATE TABLE IF NOT EXISTS visitor_logs (
                id TEXT NOT NULL DEFAULT gen_random_uuid()::TEXT,
                deployment_id TEXT NOT NULL,
                visitor_ip TEXT NOT NULL,
                user_agent TEXT,
                date TEXT NOT NULL,
                created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
                CONSTRAINT visitor_logs_pkey PRIMARY KEY (id)
            );
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS visitor_logs_deployment_id_idx ON visitor_logs(deployment_id);
        `);
        await prisma.$executeRawUnsafe(`
            CREATE INDEX IF NOT EXISTS visitor_logs_date_idx ON visitor_logs(date);
        `);
        await prisma.$executeRawUnsafe(`
            DO $$ BEGIN
                IF NOT EXISTS (
                    SELECT 1 FROM pg_constraint
                    WHERE conname = 'visitor_logs_deployment_id_fkey'
                ) THEN
                    ALTER TABLE visitor_logs
                    ADD CONSTRAINT visitor_logs_deployment_id_fkey
                    FOREIGN KEY (deployment_id) REFERENCES deployments(id) ON DELETE CASCADE ON UPDATE CASCADE;
                END IF;
            END $$;
        `);
        console.log("[startup] ✓ visitor_logs table OK");
    } catch (err) {
        console.error("[startup] Schema patch error (visitor_logs):", err.message);
    }

    try {
        await prisma.$executeRawUnsafe(`
            UPDATE deployments
            SET live_url = CONCAT('https://tasm-skill.asf.bd/site/', subdomain)
            WHERE live_url LIKE 'https://%.tasm-skill.asf.bd';
        `);
        console.log("[startup] ✓ deployments.live_url updated to path format OK");
    } catch (err) {
        console.error("[startup] Schema patch error (update live_url):", err.message);
    }

    // NOTE (MVP 2026-09-16): legacy tenant-cleanup block REMOVED.
    // schema.prisma still uses TenantStatus enum for Course.status — dropping
    // it on boot breaks Prisma. Schema changes now flow via
    // `prisma migrate deploy` (Dockerfile CMD) only.

    await prisma.$disconnect();
}

applySchemaPatches()
    .then(() => {
        console.log("[startup] Schema patches complete.");
        process.exit(0);
    })
    .catch((err) => {
        console.error("[startup] Fatal error:", err);
        process.exit(0); // still exit 0 so the server starts
    });
