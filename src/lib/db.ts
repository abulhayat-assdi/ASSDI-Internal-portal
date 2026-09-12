import { PrismaClient, Prisma } from '@prisma/client';

declare global {
  var _prisma: PrismaClient | undefined; // eslint-disable-line no-var
}

function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  });
}

/**
 * Build-safe Prisma singleton.
 * - Uses globalThis in development to survive hot-reloads without exhausting connections.
 * - In production, creates a single instance per process.
 * - During Next.js build time, DATABASE_URL may be a dummy value — that's fine because
 *   PrismaClient is only *connected* when the first query runs, not on instantiation.
 */
export const prisma: PrismaClient =
  globalThis._prisma ?? (globalThis._prisma = createPrismaClient());

// ============================================================
// Multi-tenant (Course) Row-Level Security context
// ============================================================
//
// Every course-scoped table has a Postgres RLS policy keyed off two
// session variables: app.current_course_id and app.is_super_admin
// (see prisma/migrations/20260912171615_enable_row_level_security).
// A query run without this context set returns zero rows (fail-closed) —
// so any code path that reads/writes course-scoped tables MUST go through
// withCourseContext. The bare `prisma` export above should only be used
// for tables with no course_id column (e.g. CvTemplate) or through this
// wrapper's `tx`.

export interface CourseContext {
  /** null when isSuperAdmin is true, or before a user is tied to a course */
  courseId: string | null;
  isSuperAdmin: boolean;
}

export async function withCourseContext<T>(
  ctx: CourseContext,
  fn: (tx: Prisma.TransactionClient) => Promise<T>
): Promise<T> {
  return prisma.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT set_config('app.is_super_admin', ${ctx.isSuperAdmin ? 'true' : 'false'}, true)`;
    await tx.$executeRaw`SELECT set_config('app.current_course_id', ${ctx.courseId ?? ''}, true)`;
    return fn(tx);
  });
}
