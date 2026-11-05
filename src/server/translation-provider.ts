import "server-only";
import gt from "google-translate-api-x";
import type { Locale } from "@/lib/i18n";
import { TranslationFailure, translationLimits } from "@/lib/translation";

export const translationProvider = "google-web-10.7.3";
export const translationEngine = "wikiteku-segments-v1";
export function translationEnabled() {
  return (
    !process.env.TRANSLATION_PROVIDER ||
    process.env.TRANSLATION_PROVIDER === "google"
  );
}
// The batch interface isolates provider replacement from storage and article permissions.
export type TranslateBatch = (
  texts: string[],
  source: Locale,
  target: Locale,
  signal: AbortSignal,
) => Promise<string[]>;
const googleBatch: TranslateBatch = async (texts, source, target, signal) => {
  const result = await gt(
    texts.map((text) => ({ text, from: source, to: target })),
    {
      forceBatch: true,
      rejectOnPartialFail: true,
      requestOptions: { signal },
    },
  );
  if (
    result.length !== texts.length ||
    result.some((value) => !value?.text?.trim())
  )
    throw new TranslationFailure("unavailable");
  return result.map((value) => value.text.trim());
};

export async function translateFragments(
  texts: string[],
  source: Locale,
  target: Locale,
) {
  if (!translationEnabled()) throw new TranslationFailure("disabled");
  const unique = [...new Set(texts.filter((text) => text.trim()))];
  if (
    unique.length > translationLimits.fragments ||
    unique.some((text) => text.length > translationLimits.fragmentChars)
  )
    throw new TranslationFailure("limit");
  const values = new Map<string, string>([["", ""]]);
  const signal = AbortSignal.timeout(20000);
  let cursor = 0;
  while (cursor < unique.length) {
    const batch: string[] = [];
    let chars = 0;
    while (
      cursor < unique.length &&
      batch.length < translationLimits.requestItems &&
      chars + unique[cursor].length <= translationLimits.requestChars
    ) {
      const text = unique[cursor++];
      batch.push(text);
      chars += text.length;
    }
    const translated = await googleBatch(batch, source, target, signal);
    for (let i = 0; i < batch.length; i++) values.set(batch[i], translated[i]);
  }
  return texts.map((text) => values.get(text) ?? "");
}
