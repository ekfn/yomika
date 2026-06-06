export const LOCAL_STORAGE_KEYS = {
  pageTranslationSegmentsAnalysisMode:
    "yomika.page.translation-segments.analysis-mode.v1",
  pageTranslationSegmentsShowTranslations:
    "yomika.page.translation-segments.show-translations.v1",
  pageTranslationSegmentsShowVocabulary:
    "yomika.page.translation-segments.show-vocabulary.v1",
} as const;

export type LocalStorageKey =
  (typeof LOCAL_STORAGE_KEYS)[keyof typeof LOCAL_STORAGE_KEYS];

function getLocalStorage() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function readJsonFromLocalStorage<T>(key: LocalStorageKey): T | null {
  const localStorage = getLocalStorage();

  if (!localStorage) {
    return null;
  }

  try {
    const value = localStorage.getItem(key);

    return value ? (JSON.parse(value) as T) : null;
  } catch {
    return null;
  }
}

export function writeJsonToLocalStorage(key: LocalStorageKey, value: unknown) {
  const localStorage = getLocalStorage();

  if (!localStorage) {
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Ignore unavailable storage and quota errors; defaults are still valid.
  }
}
