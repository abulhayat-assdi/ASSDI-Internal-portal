/**
 * World slug → `data-visual` accent key (see src/styles/typing-game-theme.css
 * for the actual gradients). Individual games already carry their own
 * `theme.visual` in content/games.ts; this fills the same role for the 16
 * top-level worlds shown on the adventure map / world picker.
 */
export const WORLD_VISUAL: Record<string, string> = {
  "keyboard-village": "village",
  "finger-forest": "forest",
  "letter-valley": "meadow",
  "word-city": "city",
  "sentence-kingdom": "kingdom",
  "speed-arena": "arena",
  "sky-frontier": "sky",
  "jungle-escape": "jungle",
  "desert-rally": "desert",
  "ocean-depths": "ocean",
  "arctic-pass": "arctic",
  "space-station": "space",
  "cyber-city": "neon",
  "volcano-zone": "canyon",
  "castle-siege": "castle",
  "grand-arena": "grand-arena",
};

export function worldVisual(slug: string): string {
  return WORLD_VISUAL[slug] ?? "kingdom";
}
