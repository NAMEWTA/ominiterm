import { useLocaleStore } from "../stores/localeStore.ts";
import { en } from "./en.ts";
import { zh } from "./zh.ts";

const dictionaries = { en, zh } as const;

export function useT() {
  const locale = useLocaleStore((s) => s.locale);
  return { ...en, ...dictionaries[locale] };
}
