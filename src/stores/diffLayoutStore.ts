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
 * Resolve non-overlapping Y positions for all registered DiffCards.
 * Processes top-to-bottom by anchor Y, pushing cards down to avoid:
 *   1. Previously resolved DiffCards
 *   2. Immovable obstacles (e.g. project container bounds)
 */
export function resolveAllCardPositions(
  cards: Record<string, DiffCardEntry>,
  obstacles: Rect[] = [],
): Record<string, number> {
  const entries = Object.entries(cards).sort(([, a], [, b]) => a.y - b.y);
  // Seed with obstacles as immovable rects
  const resolved: Rect[] = obstacles.map((o) => ({ ...o }));
  const result: Record<string, number> = {};

  for (const [id, card] of entries) {
    let y = card.y;
    for (const prev of resolved) {
      // Check horizontal overlap
      if (card.x < prev.x + prev.w && card.x + card.w > prev.x) {
        // Check vertical overlap against resolved position
        if (y < prev.y + prev.h + CARD_GAP && y + card.h > prev.y - CARD_GAP) {
          y = prev.y + prev.h + CARD_GAP;
        }
      }
    }
    resolved.push({ x: card.x, y, w: card.w, h: card.h });
    result[id] = y;
  }

  return result;
}
