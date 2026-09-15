import { Shield, Sparkles, Users } from "lucide-react";
import { Avatar, Badge, StatCard } from "@/components/typing-game/ui";
import { getTranslator, type Locale } from "@/lib/typing-game/i18n";
import type {
  ClanProfile,
  ClanRosterRow,
} from "@/lib/typing-game/server/clan-store";

type RoleKey = "roleLeader" | "roleCoLeader" | "roleMember";

function roleKey(role: string | null): RoleKey {
  if (role === "leader") return "roleLeader";
  if (role === "co_leader") return "roleCoLeader";
  return "roleMember";
}

/** Clan identity header: guild-hall banner, emblem, member avatars, stats. */
export function ClanBanner({
  locale,
  clan,
  topMembers = [],
}: {
  locale: Locale;
  clan: ClanProfile;
  topMembers?: ClanRosterRow[];
}) {
  const t = getTranslator(locale, "clans");
  return (
    <div className="flex flex-col gap-4" data-visual="castle">
      <div className="tap-hero-banner">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <Avatar name={clan.name} size="lg" />
            <div>
              <p className="tap-hero-eyebrow">
                <Shield className="h-3.5 w-3.5" aria-hidden="true" />
                {t(roleKey(clan.myRole))}
              </p>
              <h1 className="tap-hero-title">{clan.name}</h1>
              <p className="tap-hero-desc">{clan.motto || clan.slug}</p>
            </div>
          </div>
          {topMembers.length > 0 ? (
            <div className="flex flex-col items-end gap-1">
              <div className="tap-avatar-stack">
                {topMembers.slice(0, 6).map((m) => (
                  <Avatar key={m.userId} name={m.displayName} size="sm" />
                ))}
              </div>
              <span className="tap-hero-eyebrow">
                <Users className="h-3.5 w-3.5" aria-hidden="true" />
                {t("sectionTop")}
              </span>
            </div>
          ) : null}
        </div>
        <div className="tap-hero-meta">
          <span className="tap-chip">
            <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            {t("clanXp", { points: clan.totalXp })}
          </span>
          {clan.myRank !== null ? (
            <span className="tap-chip">{t("myRank", { rank: clan.myRank })}</span>
          ) : null}
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard
          label={t("xpLabel")}
          value={clan.totalXp}
          icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={t("sectionMembers")}
          value={clan.memberCount}
          icon={<Users className="h-4 w-4" aria-hidden="true" />}
        />
        <StatCard
          label={t("roleLabel")}
          value={<Badge tone="primary">{t(roleKey(clan.myRole))}</Badge>}
        />
        <StatCard
          label={t("colRank")}
          value={clan.myRank === null ? "—" : `#${String(clan.myRank)}`}
        />
      </div>
    </div>
  );
}
