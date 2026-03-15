import { create } from "zustand";

export type Locale = "en" | "zh";

function detectLocale(): Locale {
  const saved = localStorage.getItem("termcanvas-locale");
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
    localStorage.setItem("termcanvas-locale", locale);
    set({ locale });
  },
}));
