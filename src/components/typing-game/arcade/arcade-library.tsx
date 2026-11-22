"use client";

import { useTypingBase } from "@/components/typing-game/use-typing-base";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Clapperboard, Coins, Lock, Play, Sparkles, Star, Trophy, X } from "lucide-react";
import type { ArcadeGameInfo } from "@/lib/typing-game/arcade/catalog";
import { RewardedAdModal } from "@/components/typing-game/ads/rewarded-ad-modal";
import { GameArt } from "./game-art";

export interface LibraryGame {
  info: ArcadeGameInfo;
  price: number;
  unlocked: boolean;
  best: number | null;
  plays: number;
}


export function ArcadeLibrary({ games, coins: initialCoins }: { games: LibraryGame[]; coins: number }) {
  const BASE = `${useTypingBase()}/games`;
  const router = useRouter();
  const [coins, setCoins] = useState(initialCoins);
  const [opened, setOpened] = useState<Set<string>>(() => new Set(games.filter((g) => g.unlocked).map((g) => g.info.slug)));
  const [target, setTarget] = useState<LibraryGame | null>(null);
  const [busy, setBusy] = useState<"" | "coins" | "ad">("");
  const [msg, setMsg] = useState("");
  const [adViews, setAdViews] = useState(0);
  const [celebrate, setCelebrate] = useState<string | null>(null);

  const unlock = async (method: "coins" | "ad") => {
    if (!target) return;
    setBusy(method);
    setMsg("");
    try {
      const r = await fetch(`/api/typing-game/arcade/${target.info.slug}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method }),
      });
      const d = (await r.json()) as { balance?: number; error?: string; views?: number };
      if (r.status === 402 && d.views) {
        setAdViews(d.views);
        return;
      }
      if (!r.ok) {
        setMsg(d.error === "NOT_ENOUGH_COINS" ? "পর্যাপ্ত কয়েন নেই।" : `আনলক করা যায়নি (${d.error ?? r.status})।`);
        return;
      }
      if (typeof d.balance === "number") setCoins(d.balance);
      setOpened((s) => new Set(s).add(target.info.slug));
      setCelebrate(target.info.slug);
      setTarget(null);
      setTimeout(() => setCelebrate(null), 2200);
      router.refresh();
    } catch {
      setMsg("নেটওয়ার্ক সমস্যা — আবার চেষ্টা করুন।");
    } finally {
      setBusy("");
    }
  };

  const lockedCount = games.filter((g) => !opened.has(g.info.slug)).length;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="arcade-hero relative overflow-hidden rounded-3xl p-6 text-white sm:p-8">
        <div className="relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-white/80">Typing Arcade</p>
            <h1 className="font-display text-3xl font-black sm:text-4xl" style={{ background: "none", color: "#fff", WebkitTextFillColor: "#fff" }}>টাইপ করো, জেতো, আনলক করো!</h1>
            <p className="mt-1 max-w-2xl text-white/85">
              ৮টা চ্যালেঞ্জিং গেম — প্রতিটা ধাপে আরও দ্রুত, আরও কঠিন। খেলে কয়েন জেতো, তারপর যেকোনো গেম যেকোনো সময় আনলক করো।
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-2xl bg-black/25 px-4 py-2.5 text-lg font-extrabold backdrop-blur">
              <Coins className="h-6 w-6 text-yellow-300" aria-hidden="true" />
              <span className="tabular-nums">{coins.toLocaleString("en-US")}</span>
              <span className="text-sm font-semibold text-white/75">কয়েন</span>
            </span>
          </div>
        </div>
        {lockedCount > 0 ? (
          <p className="relative z-10 mt-4 text-sm text-white/80">
            🔒 {lockedCount}টা গেম লক করা — নিচের <b>Unlock</b> বাটনে চাপ দিয়ে কয়েন বা অ্যাড দিয়ে খুলে ফেলো।
          </p>
        ) : null}
      </div>

      {/* Grid */}
      <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
        {games.map((g) => {
          const open = opened.has(g.info.slug);
          const fresh = celebrate === g.info.slug;
          return (
            <article key={g.info.slug} className={`arcade-card group ${open ? "" : "is-locked"} ${fresh ? "is-fresh" : ""}`}>
              <div className="relative aspect-[16/9] overflow-hidden">
                <div className="arcade-art h-full w-full">
                  <GameArt slug={g.info.slug} />
                </div>
                {!open ? (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-950/45">
                    <span className="flex h-14 w-14 items-center justify-center rounded-full bg-black/55 ring-2 ring-white/40">
                      <Lock className="h-7 w-7 text-white" aria-hidden="true" />
                    </span>
                  </div>
                ) : null}
                <span className="absolute left-3 top-3 inline-flex items-center gap-0.5 rounded-full bg-black/55 px-2 py-0.5 text-[11px] font-bold text-white" title="কঠিনতা">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Star key={i} className="h-3 w-3" fill={i < g.info.difficulty ? "#facc15" : "transparent"} stroke="#facc15" aria-hidden="true" />
                  ))}
                </span>
                {fresh ? (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="arcade-unlocked-pop rounded-full bg-emerald-500 px-4 py-2 text-lg font-black text-white shadow-xl">🎉 Unlocked!</span>
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col gap-2 p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-display text-xl font-extrabold">{g.info.title}</h2>
                  {g.best !== null ? (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                      <Trophy className="h-3 w-3" aria-hidden="true" /> {g.best.toLocaleString("en-US")}
                    </span>
                  ) : null}
                </div>
                <p className="text-sm text-ink-muted">{g.info.tagline}</p>
                <p className="text-xs font-semibold text-ink-faint">দক্ষতা: {g.info.skill}</p>
                <div className="mt-auto pt-2">
                  {open ? (
                    <Link href={`${BASE}/${g.info.slug}`} className="arcade-play-btn">
                      <Play className="h-4 w-4" aria-hidden="true" /> খেলুন
                    </Link>
                  ) : (
                    <button
                      type="button"
                      className="arcade-unlock-btn"
                      onClick={() => {
                        setMsg("");
                        setTarget(g);
                      }}
                    >
                      <Sparkles className="h-4 w-4" aria-hidden="true" /> Unlock
                      <span className="ml-1 inline-flex items-center gap-1 rounded-full bg-black/20 px-2 py-0.5 text-sm">
                        <Coins className="h-3.5 w-3.5" aria-hidden="true" /> {g.price}
                      </span>
                    </button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>

      <p className="text-center text-sm text-ink-muted">
        কয়েন পাবেন গেম খেলে (স্কোর যত বেশি, কয়েন তত বেশি · নতুন সেরা স্কোরে +৫ বোনাস)। <b>Meteor Shield</b> সবসময় খোলা — ওখান থেকে শুরু করুন!
      </p>

      {/* Unlock dialog */}
      {target ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={`Unlock ${target.info.title}`}>
          <div className="arcade-dialog relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
            <button type="button" onClick={() => setTarget(null)} className="absolute right-3 top-3 z-10 rounded-full bg-black/40 p-1.5 text-white hover:bg-black/60" aria-label="Close">
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <div className="aspect-[16/7] overflow-hidden">
              <GameArt slug={target.info.slug} />
            </div>
            <div className="flex flex-col gap-3 p-5">
              <h2 className="font-display text-2xl font-black text-slate-900">Unlock {target.info.title}</h2>
              <p className="text-sm text-slate-600">{target.info.tagline}</p>
              <button type="button" className="arcade-unlock-btn w-full justify-center py-3 text-base" disabled={busy !== "" || coins < target.price} onClick={() => void unlock("coins")}>
                <Coins className="h-5 w-5" aria-hidden="true" /> {busy === "coins" ? "আনলক হচ্ছে…" : `${target.price} কয়েন দিয়ে আনলক`}
              </button>
              {coins < target.price ? (
                <p className="-mt-1 text-center text-xs font-semibold text-rose-600">
                  আপনার আছে {coins} কয়েন — আরও {target.price - coins} কয়েন লাগবে।
                </p>
              ) : (
                <p className="-mt-1 text-center text-xs text-slate-500">আনলকের পর থাকবে {coins - target.price} কয়েন</p>
              )}
              <div className="flex items-center gap-3 text-xs font-semibold uppercase text-slate-400">
                <span className="h-px flex-1 bg-slate-200" /> অথবা <span className="h-px flex-1 bg-slate-200" />
              </div>
              <button type="button" className="arcade-ad-btn w-full justify-center py-3" disabled={busy !== ""} onClick={() => void unlock("ad")}>
                <Clapperboard className="h-5 w-5" aria-hidden="true" /> {busy === "ad" ? "আনলক হচ্ছে…" : "অ্যাড দেখে ফ্রি আনলক"}
              </button>
              {msg ? <p className="text-center text-sm font-semibold text-rose-600">{msg}</p> : null}
            </div>
          </div>
        </div>
      ) : null}

      {adViews > 0 && target ? (
        <RewardedAdModal
          action="game_unlock"
          target={target.info.slug}
          views={adViews}
          onDone={() => {
            setAdViews(0);
            void unlock("ad");
          }}
          onCancel={() => setAdViews(0)}
        />
      ) : null}
    </div>
  );
}
