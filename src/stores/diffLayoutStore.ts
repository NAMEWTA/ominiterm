import { create } from "zustand";

interface DiffCardEntry {
  x: number;
  y: number;
  w: number;
  h: number;
}

const CARD_GAP = 12;

interface DiffLayoutStore {
  cards: Record<string, DiffCardEntry>;
  register: (id: string, entry: DiffCardEntry) => void;
  unregister: (id: string) => void;
}

export const useDiffLayoutStore = create<DiffLayoutStore>((set) => ({
  cards: {},

  register: (id, entry) =>
    set((state) => ({ cards: { ...state.cards, [id]: entry } })),

  unregister: (id) =>
    set((state) => {
      const { [id]: _, ...rest } = state.cards;
      return { cards: rest };
    }),
}));

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Resolve non-overlapping positions for all registered DiffCards.
 *   - Obstacles (project containers): push card RIGHT past the obstacle
 *   - Other DiffCards: push card DOWN below the other card
 */
export function resolveAllCardPositions(
  cards: Record<string, DiffCardEntry>,
  obstacles: Rect[] = [],
): Record<string, { x: number; y: number }> {
  const entries = Object.entries(cards).sort(([, a], [, b]) => a.y - b.y);
  const resolvedCards: Rect[] = [];
  const result: Record<string, { x: number; y: number }> = {};

  for (const [id, card] of entries) {
    let x = card.x;
    let y = card.y;

    // Push right to avoid project containers
    for (const obs of obstacles) {
      if (
        x < obs.x + obs.w + CARD_GAP &&
        x + card.w > obs.x &&
        y < obs.y + obs.h &&
        y + card.h > obs.y
      ) {
        x = obs.x + obs.w + CARD_GAP;
      }
    }

    // Push down to avoid other DiffCards
    for (const prev of resolvedCards) {
      if (x < prev.x + prev.w && x + card.w > prev.x) {
        if (y < prev.y + prev.h + CARD_GAP && y + card.h > prev.y - CARD_GAP) {
          y = prev.y + prev.h + CARD_GAP;
        }
      }
    }

    resolvedCards.push({ x, y, w: card.w, h: card.h });
    result[id] = { x, y };
  }

  return result;
}
