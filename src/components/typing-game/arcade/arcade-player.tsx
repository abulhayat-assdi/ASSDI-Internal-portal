"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Coins, Heart, Pause, Play, RotateCcw, Trophy, Volume2, VolumeX, X, Zap } from "lucide-react";
import { useFitHeight } from "@/components/typing-game/lesson/use-fit-height";
import { TICK_MS, WORLD_H, WORLD_W, type ArcadeContent, type ArcadeResult, type BaseSim, type SimEvent } from "@/lib/typing-game/arcade/core";
import type { ArcadeGameInfo, ArcadeSlug } from "@/lib/typing-game/arcade/catalog";
import { createSim, type KeyLog } from "@/lib/typing-game/arcade/registry";
import { Fx } from "./fx";
import { GameArt } from "./game-art";
import { Sfx, readMuted, writeMuted } from "./sound";
import { drawBubbles, drawLava, drawMeteor, drawRunner } from "./renderers-a";
import { drawBlitz, drawBomb, drawDragon, drawRacer } from "./renderers-b";
import type { MeteorShieldSim } from "@/lib/typing-game/arcade/games/meteor-shield";
import type { BubbleBurstSim } from "@/lib/typing-game/arcade/games/bubble-burst";
import type { RunnerRushSim } from "@/lib/typing-game/arcade/games/runner-rush";
import type { TurboRacerSim } from "@/lib/typing-game/arcade/games/turbo-racer";
import type { ComboBlitzSim } from "@/lib/typing-game/arcade/games/combo-blitz";
import type { BombSquadSim } from "@/lib/typing-game/arcade/games/bomb-squad";
import type { LavaClimbSim } from "@/lib/typing-game/arcade/games/lava-climb";
import type { DragonKeepSim } from "@/lib/typing-game/arcade/games/dragon-keep";

const LIBRARY = "/student-dashboard/typing-game/games";
/** Headings in the typing theme use gradient text; on dark game screens they must be plain white. */
const WHITE = { background: "none", color: "#fff", WebkitTextFillColor: "#fff" } as const;

function render(slug: ArcadeSlug, ctx: CanvasRenderingContext2D, sim: BaseSim, now: number): void {
  switch (slug) {
    case "meteor-shield":
      return drawMeteor(ctx, sim as MeteorShieldSim, now);
    case "bubble-burst":
      return drawBubbles(ctx, sim as BubbleBurstSim, now);
    case "runner-rush":
      return drawRunner(ctx, sim as RunnerRushSim, now);
    case "lava-climb":
      return drawLava(ctx, sim as LavaClimbSim, now);
    case "turbo-racer":
      return drawRacer(ctx, sim as TurboRacerSim);
    case "combo-blitz":
      return drawBlitz(ctx, sim as ComboBlitzSim, now);
    case "bomb-squad":
      return drawBomb(ctx, sim as BombSquadSim, now);
    case "dragon-keep":
      return drawDragon(ctx, sim as DragonKeepSim, now);
  }
}

/** Games that wait for the first key (or count down themselves) instead of the shared 3-2-1. */
const SELF_START = new Set<ArcadeSlug>(["combo-blitz", "lava-climb", "turbo-racer"]);

type Phase = "intro" | "loading" | "countdown" | "playing" | "paused" | "submitting" | "result" | "error";

interface Finish {
  result: ArcadeResult;
  xp: number;
  coins: number;
  best: number;
  newBest: boolean;
}

interface Hud {
  score: number;
  level: number;
  lives: number;
  maxLives: number;
  combo: number;
}

const STAT_LABEL: Record<string, string> = {
  meteors: "উল্কা ধ্বংস",
  bubbles: "বাবল ফাটানো",
  bestChain: "সেরা চেইন",
  distance: "দূরত্ব (মি.)",
  jumps: "লাফ",
  races: "রেস শেষ (Top 3)",
  wins: "১ম স্থান",
  bestMultiplier: "সেরা গুণক",
  bonusSeconds: "বোনাস সেকেন্ড",
  defused: "নিষ্ক্রিয় বোমা",
  exploded: "ফাটা বোমা",
  height: "উচ্চতা (মি.)",
  blocks: "ব্লক",
  dragonHp: "ড্রাগনের বাকি HP",
  blocked: "আটকানো মন্ত্র",
};

export function ArcadePlayer({ game, best: initialBest }: { game: ArcadeGameInfo; best: number | null }) {
  const slug = game.slug;
  const [phase, setPhase] = useState<Phase>("intro");
  const [count, setCount] = useState(3);
  const [hud, setHud] = useState<Hud>({ score: 0, level: 1, lives: 0, maxLives: 0, combo: 0 });
  const [finish, setFinish] = useState<Finish | null>(null);
  const [error, setError] = useState("");
  const [muted, setMuted] = useState(false);
  const [best, setBest] = useState(initialBest);

  const { ref: fitRef, height: fitHeight } = useFitHeight<HTMLDivElement>(46, 380);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const phaseRef = useRef<Phase>("intro");
  const simRef = useRef<BaseSim | null>(null);
  const sessionRef = useRef<string>("");
  const logRef = useRef<KeyLog>([]);
  const pendingRef = useRef<string[]>([]);
  const tickRef = useRef(0);
  const accRef = useRef(0);
  const fxRef = useRef(new Fx());
  const sfxRef = useRef<Sfx | null>(null);
  const finishingRef = useRef(false);

  const go = useCallback((p: Phase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  useEffect(() => {
    const sfx = new Sfx();
    sfx.muted = readMuted();
    sfxRef.current = sfx;
    setMuted(sfx.muted);
    return () => sfx.close();
  }, []);

  const toggleMute = () => {
    const m = !muted;
    setMuted(m);
    writeMuted(m);
    if (sfxRef.current) sfxRef.current.muted = m;
  };

  const submit = useCallback(async () => {
    if (finishingRef.current) return;
    finishingRef.current = true;
    go("submitting");
    try {
      const r = await fetch(`/api/typing-game/arcade/sessions/${sessionRef.current}/finish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ log: logRef.current, ticks: tickRef.current }),
      });
      const d = (await r.json()) as Finish & { error?: string };
      if (!r.ok) throw new Error(d.error ?? String(r.status));
      setFinish(d);
      setBest(d.best);
      go("result");
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
      go("error");
    } finally {
      finishingRef.current = false;
    }
  }, [go]);

  const start = useCallback(async () => {
    go("loading");
    setFinish(null);
    setError("");
    try {
      const r = await fetch(`/api/typing-game/arcade/${slug}/start`, { method: "POST" });
      const d = (await r.json()) as { sessionId?: string; seed?: number; content?: ArcadeContent; error?: string };
      if (!r.ok || !d.sessionId || !d.content || d.seed === undefined) throw new Error(d.error ?? String(r.status));
      sessionRef.current = d.sessionId;
      simRef.current = createSim(slug, d.content, d.seed);
      // Dev builds only: lets automated browser tests read the game state.
      if (process.env.NODE_ENV !== "production") (window as unknown as { __arcadeSim?: BaseSim }).__arcadeSim = simRef.current;
      logRef.current = [];
      pendingRef.current = [];
      tickRef.current = 0;
      accRef.current = 0;
      fxRef.current = new Fx();
      sfxRef.current?.play("start");
      if (SELF_START.has(slug)) {
        go("playing");
      } else {
        setCount(3);
        go("countdown");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "ERROR");
      go("error");
    }
  }, [go, slug]);

  // Shared 3-2-1.
  useEffect(() => {
    if (phase !== "countdown") return;
    if (count === 0) {
      go("playing");
      return;
    }
    sfxRef.current?.play("tick");
    const t = setTimeout(() => setCount((c) => c - 1), 700);
    return () => clearTimeout(t);
  }, [phase, count, go]);

  // Keyboard.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const p = phaseRef.current;
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === "Escape") {
        if (p === "playing") go("paused");
        else if (p === "paused") go("playing");
        return;
      }
      if (p === "intro" && e.key === "Enter") {
        e.preventDefault();
        void start();
        return;
      }
      if (p !== "playing") {
        if (p === "countdown" && e.key.length === 1) e.preventDefault();
        return;
      }
      if (e.key.length !== 1) return;
      e.preventDefault();
      pendingRef.current.push(e.key);
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [go, start]);

  // Leaving the tab pauses the game.
  useEffect(() => {
    const onVis = () => {
      if (document.hidden && phaseRef.current === "playing") go("paused");
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [go]);

  const handleEvent = useCallback((e: SimEvent) => {
    const fx = fxRef.current;
    const sfx = sfxRef.current;
    const x = e.x ?? WORLD_W / 2;
    const y = e.y ?? WORLD_H / 2;
    switch (e.type) {
      case "hit":
        sfx?.play("hit");
        if (e.x !== undefined) fx.burst(x, y, ["#fde047", "#fff"], 4, 2);
        break;
      case "miss":
        sfx?.play("miss");
        fx.shake = Math.max(fx.shake, 5);
        break;
      case "kill":
        sfx?.play("kill");
        fx.burst(x, y, ["#f97316", "#fde047", "#f43f5e", "#fff"], 26, 6);
        if (e.text && e.text.startsWith("-")) fx.float(x, y - 40, e.text, "#fde047", 40);
        else if (e.text && e.text.startsWith("Chain")) fx.float(x, y - 30, e.text, "#a7f3d0", 30);
        break;
      case "bonus":
        sfx?.play("bonus");
        fx.burst(x, y, ["#fde047", "#facc15", "#fff"], 30, 7);
        if (e.text) fx.float(x, y - 30, e.text, "#fde047", 34);
        break;
      case "combo":
        sfx?.play("combo");
        // Combo Blitz shows the streak on its ring already.
        if (slug !== "combo-blitz") fx.float(x, Math.max(80, y - 40), `Combo ${e.text}!`, "#f0abfc", 30);
        break;
      case "level":
        sfx?.play("level");
        if (slug === "combo-blitz") fx.float(WORLD_W / 2 + 150, 150, e.text ?? "", "#f9a8d4", 34);
        else if (e.text) fx.showBanner(e.text);
        break;
      case "lose":
        sfx?.play("lose");
        fx.hurt();
        fx.burst(x, y, ["#ef4444", "#f97316", "#78716c"], 30, 7);
        break;
      case "win":
        sfx?.play("win");
        fx.showBanner(slug === "combo-blitz" ? "TIME!" : "YOU WIN!");
        break;
      case "over":
        sfx?.play("over");
        break;
    }
  }, [slug]);

  // Game loop: fixed ticks for the simulation, every frame for drawing.
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    let hudAt = 0;
    const frame = (ts: number) => {
      const dt = Math.min(0.25, (ts - last) / 1000);
      last = ts;
      const sim = simRef.current;
      if (sim && phaseRef.current === "playing") {
        accRef.current += dt * 1000;
        let steps = 0;
        while (accRef.current >= TICK_MS && steps < 20) {
          const tick = tickRef.current;
          for (const k of pendingRef.current) {
            logRef.current.push([tick, k]);
            sim.key(k);
          }
          pendingRef.current = [];
          sim.tick();
          tickRef.current = tick + 1;
          accRef.current -= TICK_MS;
          steps++;
          for (const e of sim.events) handleEvent(e);
          sim.events.length = 0;
          if (sim.over) {
            void submit();
            break;
          }
        }
      }
      fxRef.current.update(dt);
      draw(ts);
      if (sim && ts - hudAt > 100) {
        hudAt = ts;
        setHud((h) =>
          h.score === Math.round(sim.score) && h.level === sim.level && h.lives === sim.lives && h.combo === sim.combo
            ? h
            : { score: Math.round(sim.score), level: sim.level, lives: sim.lives, maxLives: sim.maxLives, combo: sim.combo },
        );
      }
      raf = requestAnimationFrame(frame);
    };
    const draw = (now: number) => {
      const canvas = canvasRef.current;
      const sim = simRef.current;
      if (!canvas || !sim) return;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const dpr = window.devicePixelRatio || 1;
      const scale = (canvas.width / WORLD_W) || dpr;
      const fx = fxRef.current;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const sx = fx.shake ? (Math.random() - 0.5) * fx.shake * 2 : 0;
      const sy = fx.shake ? (Math.random() - 0.5) * fx.shake * 2 : 0;
      ctx.setTransform(scale, 0, 0, scale, sx * scale, sy * scale);
      render(slug, ctx, sim, now);
      fx.draw(ctx);
      ctx.setTransform(scale, 0, 0, scale, 0, 0);
      fx.drawOverlay(ctx, WORLD_W, WORLD_H);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [slug, handleEvent, submit]);

  // Fit the 5:3 canvas into the stage.
  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;
    const fit = () => {
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      const cw = Math.max(200, Math.min(w, (h * WORLD_W) / WORLD_H));
      const ch = (cw * WORLD_H) / WORLD_W;
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${cw}px`;
      canvas.style.height = `${ch}px`;
      canvas.width = Math.round(cw * dpr);
      canvas.height = Math.round(ch * dpr);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(stage);
    return () => ro.disconnect();
  }, []);

  const quit = () => {
    if (phaseRef.current === "playing" || phaseRef.current === "paused") void submit();
  };

  const mult = slug === "meteor-shield" || slug === "runner-rush" ? 1 + Math.min(4, Math.floor(hud.combo / 20)) : null;

  return (
    <div ref={fitRef} className="flex flex-col gap-2" style={fitHeight ? { height: fitHeight } : undefined}>
      {/* HUD */}
      <div className="tap-card flex flex-wrap items-center gap-x-5 gap-y-2 px-4 py-2" style={{ background: `linear-gradient(90deg, ${game.colors[0]}, ${game.colors[1]})`, color: "#fff" }}>
        <Link href={LIBRARY} className="inline-flex items-center gap-1 text-sm font-semibold opacity-90 hover:opacity-100">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> সব গেম
        </Link>
        <span className="font-display text-lg font-extrabold" style={WHITE}>{game.title}</span>
        <span className="ml-auto flex items-center gap-4 text-sm font-semibold tabular-nums">
          <span>
            Score <b className="text-lg">{hud.score.toLocaleString("en-US")}</b>
          </span>
          <span>
            {game.scoreLabel === "Best x" ? "x" : `${game.scoreLabel} `}
            <b className="text-lg">{hud.level}</b>
          </span>
          {hud.maxLives > 1 ? (
            <span className="flex items-center gap-0.5" aria-label={`${hud.lives} lives`}>
              {Array.from({ length: hud.maxLives }, (_, i) => (
                <Heart key={i} className="h-4 w-4" fill={i < hud.lives ? "#fff" : "transparent"} aria-hidden="true" />
              ))}
            </span>
          ) : null}
          {mult && mult > 1 ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" /> x{mult}
            </span>
          ) : null}
          {best !== null ? (
            <span className="hidden items-center gap-1 opacity-90 sm:inline-flex">
              <Trophy className="h-4 w-4" aria-hidden="true" /> {best.toLocaleString("en-US")}
            </span>
          ) : null}
        </span>
        <span className="flex items-center gap-1">
          <button type="button" onClick={toggleMute} className="rounded-full p-1.5 hover:bg-white/20" aria-label={muted ? "Sound on" : "Mute"} title={muted ? "শব্দ চালু" : "শব্দ বন্ধ"}>
            {muted ? <VolumeX className="h-5 w-5" aria-hidden="true" /> : <Volume2 className="h-5 w-5" aria-hidden="true" />}
          </button>
          {phase === "playing" || phase === "paused" ? (
            <>
              <button type="button" onClick={() => go(phase === "playing" ? "paused" : "playing")} className="rounded-full p-1.5 hover:bg-white/20" aria-label="Pause" title="Pause (Esc)">
                {phase === "playing" ? <Pause className="h-5 w-5" aria-hidden="true" /> : <Play className="h-5 w-5" aria-hidden="true" />}
              </button>
              <button type="button" onClick={quit} className="rounded-full p-1.5 hover:bg-white/20" aria-label="End game" title="খেলা শেষ করুন">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </>
          ) : null}
        </span>
      </div>

      {/* Stage */}
      <div ref={stageRef} className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-2xl"
        style={{ background: `radial-gradient(circle at 50% 40%, ${game.colors[1]}55, transparent 70%), linear-gradient(160deg, ${game.colors[0]}, #050816)` }}>
        <canvas ref={canvasRef} className="block rounded-xl" />
        {(phase === "intro" || phase === "loading") && !simRef.current ? (
          <div className="absolute inset-0 scale-105 blur-[2px]" aria-hidden="true">
            <GameArt slug={slug} />
          </div>
        ) : null}

        {phase === "intro" || phase === "loading" ? (
          <Overlay>
            <h2 className="font-display text-4xl font-extrabold" style={WHITE}>{game.title}</h2>
            <p className="max-w-xl text-base opacity-90">{game.tagline}</p>
            <ul className="mx-auto max-w-xl space-y-1.5 text-left text-sm opacity-90">
              {game.howTo.map((h) => (
                <li key={h} className="flex gap-2">
                  <span aria-hidden="true">▸</span>
                  {h}
                </li>
              ))}
            </ul>
            <button type="button" onClick={() => void start()} disabled={phase === "loading"} className="arcade-cta mt-2 text-lg">
              <Play className="h-5 w-5" aria-hidden="true" /> {phase === "loading" ? "লোড হচ্ছে…" : "খেলা শুরু করুন"}
            </button>
            <p className="text-xs opacity-70">Enter চাপলেও শুরু হবে · Esc = Pause · শুধু ইংরেজি কীবোর্ড</p>
          </Overlay>
        ) : null}

        {phase === "countdown" ? (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="font-display text-[9rem] font-black text-white drop-shadow-[0_6px_20px_rgba(0,0,0,0.6)]">{count || "GO!"}</span>
          </div>
        ) : null}

        {phase === "paused" ? (
          <Overlay>
            <h2 className="font-display text-4xl font-extrabold" style={WHITE}>Paused</h2>
            <button type="button" onClick={() => go("playing")} className="arcade-cta">
              <Play className="h-5 w-5" aria-hidden="true" /> চালিয়ে যান (Esc)
            </button>
            <button type="button" onClick={quit} className="text-sm underline opacity-80">
              এখানেই খেলা শেষ করুন
            </button>
          </Overlay>
        ) : null}

        {phase === "submitting" ? (
          <Overlay>
            <p className="text-lg font-semibold">স্কোর যাচাই হচ্ছে…</p>
          </Overlay>
        ) : null}

        {phase === "error" ? (
          <Overlay>
            <p className="text-lg font-semibold">কিছু একটা সমস্যা হয়েছে ({error})।</p>
            <div className="flex gap-2">
              {sessionRef.current && simRef.current ? (
                <button type="button" onClick={() => void submit()} className="arcade-cta">
                  আবার পাঠান
                </button>
              ) : null}
              <button type="button" onClick={() => void start()} className="arcade-cta">
                <RotateCcw className="h-5 w-5" aria-hidden="true" /> নতুন খেলা
              </button>
            </div>
          </Overlay>
        ) : null}

        {phase === "result" && finish ? (
          <Overlay>
            <p className="text-sm font-bold uppercase tracking-widest opacity-80">{finish.result.won ? "জয়!" : "Game Over"}</p>
            <p className="font-display text-6xl font-black tabular-nums">{finish.result.score.toLocaleString("en-US")}</p>
            {finish.newBest ? <span className="rounded-full bg-yellow-300 px-3 py-1 text-sm font-extrabold text-yellow-900">🏆 নতুন সেরা স্কোর!</span> : <p className="text-sm opacity-80">সেরা: {finish.best.toLocaleString("en-US")}</p>}
            <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm sm:grid-cols-4">
              <Stat label={game.scoreLabel === "Best x" ? "সেরা গুণক" : game.scoreLabel} value={String(finish.result.level)} />
              <Stat label="গতি" value={`${Math.round(finish.result.wpm)} wpm`} />
              <Stat label="নির্ভুলতা" value={`${Math.round(finish.result.accuracy)}%`} />
              <Stat label="সময়" value={`${Math.floor(finish.result.durationMs / 60000)}:${String(Math.floor(finish.result.durationMs / 1000) % 60).padStart(2, "0")}`} />
              {Object.entries(finish.result.stats).map(([k, v]) => (STAT_LABEL[k] ? <Stat key={k} label={STAT_LABEL[k]} value={String(v)} /> : null))}
              <Stat label="সেরা কম্বো" value={String(finish.result.maxCombo)} />
            </div>
            {finish.xp > 0 || finish.coins > 0 ? (
              <div className="flex gap-2">
                <span className="rounded-full bg-white/20 px-3 py-1 text-sm font-bold">+{finish.xp} XP</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-yellow-300/90 px-3 py-1 text-sm font-bold text-yellow-900">
                  <Coins className="h-4 w-4" aria-hidden="true" /> +{finish.coins}
                </span>
              </div>
            ) : (
              <p className="text-xs opacity-70">অন্তত ১৫ সেকেন্ড ও ২০টা সঠিক কী হলে XP আর কয়েন পাওয়া যায়।</p>
            )}
            <div className="flex flex-wrap justify-center gap-2">
              <button type="button" onClick={() => void start()} className="arcade-cta">
                <RotateCcw className="h-5 w-5" aria-hidden="true" /> আবার খেলুন
              </button>
              <Link href={LIBRARY} className="rounded-full border border-white/40 px-5 py-2.5 font-semibold hover:bg-white/10">
                সব গেম
              </Link>
            </div>
          </Overlay>
        ) : null}
      </div>
    </div>
  );
}

function Overlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 overflow-auto bg-slate-950/75 p-6 text-center text-white backdrop-blur-sm">
      {children}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-center">
      <span className="text-xs opacity-70">{label}</span>
      <span className="text-lg font-bold tabular-nums">{value}</span>
    </div>
  );
}
