export const languageCodes = ["en", "ja", "kn"] as const;
export type Language = (typeof languageCodes)[number];
export const languageNames: Record<Language, string> = {
  en: "English", ja: "日本語", kn: "ಕನ್ನಡ",
};
export function isLanguage(value: unknown): value is Language {
  return languageCodes.some(code => code === value);
}
