import { cache as reactCache } from 'react';
import type { Course } from '@prisma/client';
import { withCourseContext } from './db';

// ── In-memory cache (slug → course, short TTL) ──────────────────────────────
// Short TTL because status/branding can change from the super-admin panel
// and we want that to take effect quickly without needing manual invalidation
// everywhere a course is edited.

interface CacheEntry {
  course: Course | null;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 60 * 1000; // 1 minute

function getCached(slug: string): Course | null | undefined {
  const entry = cache.get(slug);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    cache.delete(slug);
    return undefined;
  }
  return entry.course;
}

function setCached(slug: string, course: Course | null) {
  cache.set(slug, { course, expiresAt: Date.now() + CACHE_TTL_MS });
}

export function invalidateCourseCache(slug: string) {
  cache.delete(slug);
}

// ── Subdomain extraction ─────────────────────────────────────────────────────

// Subdomains that are never course slugs.
// 'admin' is reserved for the super-admin panel host (admin.<base domain>).
const RESERVED_SUBDOMAINS = new Set(['www', 'admin', 'api', 'mail', 'ftp', 'app', 'portal']);
const SUPER_ADMIN_SUBDOMAIN = 'admin';

function getBaseDomain(): string {
  return (process.env.NEXT_PUBLIC_BASE_DOMAIN || 'tasm-skill.asf.bd').toLowerCase();
}

/** Returns the subdomain label for any host, or null for the bare root domain. */
function extractSubdomain(host: string): string | null {
  const hostname = host.split(':')[0].toLowerCase();
  const baseDomain = getBaseDomain();

  if (hostname.endsWith('.localhost')) {
    return hostname.slice(0, -'.localhost'.length) || null;
  }
  if (hostname.endsWith('.' + baseDomain)) {
    return hostname.slice(0, hostname.length - baseDomain.length - 1) || null;
  }
  return null;
}

/** Returns the course slug for a host, or null if it's the root/reserved/unrelated domain. */
export function extractCourseSlug(host: string): string | null {
  const subdomain = extractSubdomain(host);
  if (!subdomain || RESERVED_SUBDOMAINS.has(subdomain)) return null;
  return subdomain;
}

/** True when this request is on the reserved super-admin host (admin.<base domain>). */
export function isSuperAdminHost(host: string): boolean {
  return extractSubdomain(host) === SUPER_ADMIN_SUBDOMAIN;
}

// ── Course lookup ────────────────────────────────────────────────────────────
// Resolving "which course is this slug" is a platform-directory read, not
// tenant data — it must run with the super-admin RLS bypass since, by
// definition, we don't know a courseId to scope by yet.

export async function getCourseBySlug(slug: string): Promise<Course | null> {
  const cached = getCached(slug);
  if (cached !== undefined) return cached;

  const course = await withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
    tx.course.findUnique({ where: { slug } })
  );
  setCached(slug, course);
  return course;
}

// Deduped per-request: the root layout's generateMetadata and the page it
// renders both look up the same course, so this avoids a duplicate query.
export const getCourseById = reactCache(async (id: string): Promise<Course | null> => {
  return withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
    tx.course.findUnique({ where: { id } })
  );
});

export function isCourseUsable(course: Course): boolean {
  return course.status === 'ACTIVE' || course.status === 'TRIAL';
}

// ── Public course directory ─────────────────────────────────────────────────
// Backs the course-directory site on the bare root domain — a public listing,
// so only safe-to-show fields are selected (no settings/internal columns).

export interface PublicCourseSummary {
  slug: string;
  name: string;
  tagline: string | null;
  logoUrl: string | null;
  primaryColor: string;
}

/** Builds an absolute URL for a given subdomain of the current request's host. */
function buildSubdomainUrl(currentHost: string, subdomain: string, path = ''): string {
  const [rawHostname, port] = currentHost.split(':');
  const hostname = rawHostname.replace(/^www\./, '');
  const isLocal = hostname === 'localhost' || hostname.endsWith('.localhost');
  const protocol = isLocal ? 'http' : 'https';
  const portSuffix = port ? `:${port}` : '';
  return `${protocol}://${subdomain}.${hostname}${portSuffix}${path}`;
}

/** Builds an absolute URL for a course's own subdomain from the current request's host. */
export function buildCourseUrl(currentHost: string, slug: string): string {
  return buildSubdomainUrl(currentHost, slug);
}

/** Builds an absolute URL for the reserved super-admin host from the current request's host. */
export function buildSuperAdminUrl(currentHost: string, path = '/super-admin/login'): string {
  return buildSubdomainUrl(currentHost, SUPER_ADMIN_SUBDOMAIN, path);
}

export async function listPublicCourses(): Promise<PublicCourseSummary[]> {
  return withCourseContext({ courseId: null, isSuperAdmin: true }, (tx) =>
    tx.course.findMany({
      where: { status: { in: ['ACTIVE', 'TRIAL'] } },
      orderBy: { name: 'asc' },
      select: { slug: true, name: true, tagline: true, logoUrl: true, primaryColor: true },
    })
  );
}
