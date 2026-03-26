import { create } from "zustand";

export type Locale = "en" | "zh";

const STORAGE_KEY = "ominiterm-locale";
const LEGACY_STORAGE_KEY = "termcanvas-locale";

function detectLocale(): Locale {
  const saved =
    localStorage.getItem(STORAGE_KEY) ??
    localStorage.getItem(LEGACY_STORAGE_KEY);
  if (
    !localStorage.getItem(STORAGE_KEY) &&
    saved &&
    localStorage.getItem(LEGACY_STORAGE_KEY)
  ) {
    localStorage.setItem(STORAGE_KEY, saved);
    localStorage.removeItem(LEGACY_STORAGE_KEY);
  }
  if (saved === "en" || saved === "zh") return saved;
  return navigator.language.startsWith("zh") ? "zh" : "en";
}

interface LocaleStore {
  locale: Locale;
  setLocale: (locale: Locale) => void;
}

export const useLocaleStore = create<LocaleStore>((set) => ({
  locale: detectLocale(),
  setLocale: (locale) => {
    localStorage.setItem(STORAGE_KEY, locale);
    set({ locale });
  },
}));

