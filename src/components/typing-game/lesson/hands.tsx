import { FINGERS, type FingerId } from "@/lib/typing-game/curriculum/keyboard";

interface FingerShape {
  id: FingerId;
  x: number;
  h: number;
}

// Left hand, fingers left→right: little, ring, middle, index (x = finger centre).
const LEFT: FingerShape[] = [
  { id: "l-pinky", x: 70, h: 62 },
  { id: "l-ring", x: 112, h: 84 },
  { id: "l-middle", x: 154, h: 94 },
  { id: "l-index", x: 196, h: 84 },
];
const PALM_TOP = 110;
const FW = 34;

function Hand({ side, active }: { side: "left" | "right"; active: FingerId[] }) {
  const fingers = side === "left" ? LEFT : LEFT.map((f) => ({ ...f, id: f.id.replace("l-", "r-") as FingerId, x: 600 - f.x }));
  const palmX = side === "left" ? 52 : 600 - 52 - 168;
  const thumbX = side === "left" ? 236 : 600 - 236;
  const thumbRot = side === "left" ? -38 : 38;
  const thumbOn = active.includes("thumb");
  const skin = "var(--tap-surface-solid)";
  const line = "var(--tap-border-strong)";
  return (
    <g>
      {fingers.map((f) => {
        const on = active.includes(f.id);
        const color = FINGERS[f.id].color;
        return (
          <g key={f.id}>
            <rect
              x={f.x - FW / 2}
              y={PALM_TOP - f.h}
              width={FW}
              height={f.h + 20}
              rx={FW / 2}
              fill={on ? color : skin}
              stroke={on ? color : line}
              strokeWidth={2}
            />
            <circle cx={f.x} cy={PALM_TOP - f.h + 14} r={6} fill={color} opacity={on ? 0 : 0.9} />
          </g>
        );
      })}
      <rect
        x={thumbX - FW / 2}
        y={PALM_TOP + 16}
        width={FW}
        height={74}
        rx={FW / 2}
        fill={thumbOn ? FINGERS.thumb.color : skin}
        stroke={thumbOn ? FINGERS.thumb.color : line}
        strokeWidth={2}
        transform={`rotate(${thumbRot} ${thumbX} ${PALM_TOP + 40})`}
      />
      <rect x={palmX} y={PALM_TOP} width={168} height={92} rx={36} fill={skin} stroke={line} strokeWidth={2} />
    </g>
  );
}

/** Two schematic hands; the fingers for the next key (and its Shift) are filled with their colour. */
export function Hands({ fingers, className }: { fingers: FingerId[]; className?: string }) {
  return (
    <svg viewBox="0 0 600 210" className={className ?? "w-full"} aria-hidden="true">
      <Hand side="left" active={fingers} />
      <Hand side="right" active={fingers} />
    </svg>
  );
}
