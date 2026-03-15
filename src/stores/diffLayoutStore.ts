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

/**
 * Given all registered DiffCards, resolve a non-overlapping Y position
 * for the card with the given id.
 */
export function resolveCardY(
  cards: Record<string, DiffCardEntry>,
  id: string,
): number {
  const self = cards[id];
  if (!self) return 0;

  // Get other cards sorted by y
  const others = Object.entries(cards)
    .filter(([k]) => k !== id)
    .map(([, v]) => v)
    .sort((a, b) => a.y - b.y);

  let y = self.y;

  for (const other of others) {
    // Check horizontal overlap
    if (self.x < other.x + other.w && self.x + self.w > other.x) {
      // Check vertical overlap
      if (y < other.y + other.h + CARD_GAP && y + self.h > other.y - CARD_GAP) {
        y = other.y + other.h + CARD_GAP;
      }
    }
  }

  return y;
}
