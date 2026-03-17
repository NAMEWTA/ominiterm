import { create } from "zustand";
import type { ComposerImageAttachment } from "../types";

interface ComposerStore {
  draft: string;
  images: ComposerImageAttachment[];
  isSubmitting: boolean;
  error: string | null;
  setDraft: (draft: string) => void;
  addImages: (images: ComposerImageAttachment[]) => void;
  removeImage: (imageId: string) => void;
  clearImages: () => void;
  clear: () => void;
  setSubmitting: (isSubmitting: boolean) => void;
  setError: (error: string | null) => void;
}

export const useComposerStore = create<ComposerStore>((set) => ({
  draft: "",
  images: [],
  isSubmitting: false,
  error: null,

  setDraft: (draft) => set({ draft }),
  addImages: (images) =>
    set((state) => ({
      images: [...state.images, ...images],
      error: null,
    })),
  removeImage: (imageId) =>
    set((state) => ({
      images: state.images.filter((image) => image.id !== imageId),
    })),
  clearImages: () => set({ images: [] }),
  clear: () =>
    set({
      draft: "",
      images: [],
      error: null,
      isSubmitting: false,
    }),
  setSubmitting: (isSubmitting) => set({ isSubmitting }),
  setError: (error) => set({ error }),
}));
