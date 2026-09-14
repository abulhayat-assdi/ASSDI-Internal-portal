/**
 * i18n foundation (M3). English default; Bangla fully supported.
 *
 * Namespaced catalogs under messages/{en,bn}/*.json. Every namespace is a
 * FLAT string map so keys stay strongly typed (`keyof`). Bangla dicts are
 * merged over English at load, so a missing Bangla key falls back to English
 * instead of rendering blank. Typing GAME PROMPTS are intentionally excluded
 * here — they belong to the content/game system (later milestone).
 *
 * Edge-safe: static JSON imports only, no Node APIs (middleware imports this).
 */
import enA11y from "@/messages/typing-game/en/a11y.json";
import enAuth from "@/messages/typing-game/en/auth.json";
import enCommon from "@/messages/typing-game/en/common.json";
import enClans from "@/messages/typing-game/en/clans.json";
import enCompetitions from "@/messages/typing-game/en/competitions.json";
import enDashboard from "@/messages/typing-game/en/dashboard.json";
import enErrors from "@/messages/typing-game/en/errors.json";
import enGames from "@/messages/typing-game/en/games.json";
import enHome from "@/messages/typing-game/en/home.json";
import enLeaderboard from "@/messages/typing-game/en/leaderboard.json";
import enMap from "@/messages/typing-game/en/map.json";
import enMissions from "@/messages/typing-game/en/missions.json";
import enWars from "@/messages/typing-game/en/wars.json";
import enBosses from "@/messages/typing-game/en/bosses.json";
import enSeasons from "@/messages/typing-game/en/seasons.json";
import enNav from "@/messages/typing-game/en/nav.json";
import enOnboarding from "@/messages/typing-game/en/onboarding.json";
import enPlay from "@/messages/typing-game/en/play.json";
import enProfile from "@/messages/typing-game/en/profile.json";
import enProgress from "@/messages/typing-game/en/progress.json";
import enResult from "@/messages/typing-game/en/result.json";
import enStaff from "@/messages/typing-game/en/staff.json";
import enTournaments from "@/messages/typing-game/en/tournaments.json";
import enAdaptive from "@/messages/typing-game/en/adaptive.json";
import enShop from "@/messages/typing-game/en/shop.json";
import enRewards from "@/messages/typing-game/en/rewards.json";
import bnA11y from "@/messages/typing-game/bn/a11y.json";
import bnAuth from "@/messages/typing-game/bn/auth.json";
import bnCommon from "@/messages/typing-game/bn/common.json";
import bnClans from "@/messages/typing-game/bn/clans.json";
import bnCompetitions from "@/messages/typing-game/bn/competitions.json";
import bnDashboard from "@/messages/typing-game/bn/dashboard.json";
import bnErrors from "@/messages/typing-game/bn/errors.json";
import bnGames from "@/messages/typing-game/bn/games.json";
import bnHome from "@/messages/typing-game/bn/home.json";
import bnLeaderboard from "@/messages/typing-game/bn/leaderboard.json";
import bnMap from "@/messages/typing-game/bn/map.json";
import bnMissions from "@/messages/typing-game/bn/missions.json";
import bnWars from "@/messages/typing-game/bn/wars.json";
import bnBosses from "@/messages/typing-game/bn/bosses.json";
import bnSeasons from "@/messages/typing-game/bn/seasons.json";
import bnNav from "@/messages/typing-game/bn/nav.json";
import bnOnboarding from "@/messages/typing-game/bn/onboarding.json";
import bnPlay from "@/messages/typing-game/bn/play.json";
import bnProfile from "@/messages/typing-game/bn/profile.json";
import bnProgress from "@/messages/typing-game/bn/progress.json";
import bnResult from "@/messages/typing-game/bn/result.json";
import bnStaff from "@/messages/typing-game/bn/staff.json";
import bnTournaments from "@/messages/typing-game/bn/tournaments.json";
import bnAdaptive from "@/messages/typing-game/bn/adaptive.json";
import bnShop from "@/messages/typing-game/bn/shop.json";
import bnRewards from "@/messages/typing-game/bn/rewards.json";

export const LOCALES = ["en", "bn"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";

export interface Messages {
  a11y: typeof enA11y;
  auth: typeof enAuth;
  common: typeof enCommon;
  clans: typeof enClans;
  competitions: typeof enCompetitions;
  dashboard: typeof enDashboard;
  errors: typeof enErrors;
  games: typeof enGames;
  home: typeof enHome;
  leaderboard: typeof enLeaderboard;
  map: typeof enMap;
  missions: typeof enMissions;
  wars: typeof enWars;
  bosses: typeof enBosses;
  seasons: typeof enSeasons;
  nav: typeof enNav;
  onboarding: typeof enOnboarding;
  play: typeof enPlay;
  profile: typeof enProfile;
  progress: typeof enProgress;
  result: typeof enResult;
  staff: typeof enStaff;
  tournaments: typeof enTournaments;
  adaptive: typeof enAdaptive;
  shop: typeof enShop;
  rewards: typeof enRewards;
}

export type Namespace = keyof Messages;
export type NamespaceMap = { [K in Namespace]: Messages[K] };

const en: Messages = {
  a11y: enA11y,
  auth: enAuth,
  common: enCommon,
  clans: enClans,
  competitions: enCompetitions,
  dashboard: enDashboard,
  errors: enErrors,
  games: enGames,
  home: enHome,
  leaderboard: enLeaderboard,
  map: enMap,
  missions: enMissions,
  wars: enWars,
  bosses: enBosses,
  seasons: enSeasons,
  nav: enNav,
  onboarding: enOnboarding,
  play: enPlay,
  profile: enProfile,
  progress: enProgress,
  result: enResult,
  staff: enStaff,
  tournaments: enTournaments,
  adaptive: enAdaptive,
  shop: enShop,
  rewards: enRewards,
};

/** Bangla may omit keys; anything missing falls back to English. */
type PartialMessages = { [K in Namespace]?: Partial<Messages[K]> };
const bnRaw: PartialMessages = {
  a11y: bnA11y,
  auth: bnAuth,
  common: bnCommon,
  clans: bnClans,
  competitions: bnCompetitions,
  dashboard: bnDashboard,
  errors: bnErrors,
  games: bnGames,
  home: bnHome,
  leaderboard: bnLeaderboard,
  map: bnMap,
  missions: bnMissions,
  wars: bnWars,
  bosses: bnBosses,
  seasons: bnSeasons,
  nav: bnNav,
  onboarding: bnOnboarding,
  play: bnPlay,
  profile: bnProfile,
  progress: bnProgress,
  result: bnResult,
  staff: bnStaff,
  tournaments: bnTournaments,
  adaptive: bnAdaptive,
  shop: bnShop,
  rewards: bnRewards,
};

function mergeNamespace<K extends Namespace>(
  base: Messages[K],
  overlay: Partial<Messages[K]> | undefined,
): Messages[K] {
  return { ...base, ...overlay };
}

/** Narrow unknown input (URL segment, cookie, header) to a supported locale. */
export function resolveLocale(input: unknown): Locale {
  if (typeof input === "string") {
    const v = input.trim().toLowerCase();
    if ((LOCALES as readonly string[]).includes(v)) return v as Locale;
  }
  return DEFAULT_LOCALE;
}

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" &&
    (LOCALES as readonly string[]).includes(value.trim().toLowerCase())
  );
}

/** Split `/bn/dashboard` → `{ locale: 'bn', path: '/dashboard' }`. */
export function splitLocalePrefix(pathname: string): {
  locale: Locale | null;
  path: string;
} {
  const seg = pathname.split("/");
  const candidate = seg[1] ?? "";
  if (isLocale(candidate)) {
    const rest = `/${seg.slice(2).join("/")}`.replace(/\/+$/, "") || "/";
    return { locale: candidate, path: rest === "" ? "/" : rest };
  }
  return { locale: null, path: pathname };
}

export function getMessages(locale: Locale): Messages {
  if (locale !== "bn") return en;
  return {
    a11y: mergeNamespace<"a11y">(en.a11y, bnRaw.a11y),
    auth: mergeNamespace<"auth">(en.auth, bnRaw.auth),
    common: mergeNamespace<"common">(en.common, bnRaw.common),
    clans: mergeNamespace<"clans">(en.clans, bnRaw.clans),
    competitions: mergeNamespace<"competitions">(
      en.competitions,
      bnRaw.competitions,
    ),
    dashboard: mergeNamespace<"dashboard">(en.dashboard, bnRaw.dashboard),
    errors: mergeNamespace<"errors">(en.errors, bnRaw.errors),
    games: mergeNamespace<"games">(en.games, bnRaw.games),
    home: mergeNamespace<"home">(en.home, bnRaw.home),
    leaderboard: mergeNamespace<"leaderboard">(en.leaderboard, bnRaw.leaderboard),
    map: mergeNamespace<"map">(en.map, bnRaw.map),
    missions: mergeNamespace<"missions">(en.missions, bnRaw.missions),
    wars: mergeNamespace<"wars">(en.wars, bnRaw.wars),
    bosses: mergeNamespace<"bosses">(en.bosses, bnRaw.bosses),
    seasons: mergeNamespace<"seasons">(en.seasons, bnRaw.seasons),
    nav: mergeNamespace<"nav">(en.nav, bnRaw.nav),
    onboarding: mergeNamespace<"onboarding">(en.onboarding, bnRaw.onboarding),
    play: mergeNamespace<"play">(en.play, bnRaw.play),
    profile: mergeNamespace<"profile">(en.profile, bnRaw.profile),
    progress: mergeNamespace<"progress">(en.progress, bnRaw.progress),
    result: mergeNamespace<"result">(en.result, bnRaw.result),
    staff: mergeNamespace<"staff">(en.staff, bnRaw.staff),
    tournaments: mergeNamespace<"tournaments">(en.tournaments, bnRaw.tournaments),
    adaptive: mergeNamespace<"adaptive">(en.adaptive, bnRaw.adaptive),
    shop: mergeNamespace<"shop">(en.shop, bnRaw.shop),
    rewards: mergeNamespace<"rewards">(en.rewards, bnRaw.rewards),
  };
}

/** Raw namespace maps (English source of truth) for catalog-integrity tests. */
export function getNamespaceMaps(): { en: NamespaceMap; bn: PartialMessages } {
  return { en, bn: bnRaw };
}

export type Vars = Record<string, string | number>;

function interpolate(template: string, vars?: Vars): string {
  if (!vars) return template;
  return template.replace(/\{(\w+)\}/g, (m, k: string) =>
    k in vars ? String(vars[k]) : m,
  );
}

/**
 * Strongly typed translator over one namespace with English fallback.
 * Unknown keys can never crash rendering: worst case renders `[key]`.
 */
export function createTranslator<N extends Record<string, string>>(
  primary: Partial<N>,
  fallback: N,
) {
  return function t(key: keyof N & string, vars?: Vars): string {
    const template = primary[key] ?? fallback[key];
    if (typeof template !== "string") return `[${key}]`;
    return interpolate(template, vars);
  };
}

/** Convenience: translator bound to a locale's namespace. */
export function getTranslator<K extends Namespace>(
  locale: Locale,
  namespace: K,
): (key: keyof Messages[K] & string, vars?: Vars) => string {
  const messages = getMessages(locale);
  const primary: Partial<Messages[K]> =
    locale === "bn" ? (bnRaw[namespace] as Partial<Messages[K]>) : {};
  return createTranslator<Messages[K] & Record<string, string>>(
    primary,
    messages[namespace],
  );
}
