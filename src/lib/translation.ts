import { z } from "zod";

export const translationPair = z
  .object({ source: z.enum(["ru", "en"]), target: z.enum(["ru", "en"]) })
  .refine((value) => value.source !== value.target, { message: "language" });
export const translationRequest = translationPair.and(
  z.object({ revision: z.number().int().positive() }),
);
export const translatedContent = z.object({
  title: z.string().trim().min(1).max(500),
  summary: z.string().max(2000),
  markdown: z.string().max(100000),
});
export type TranslatedContent = z.infer<typeof translatedContent>;
export const translationCorrection = translationRequest.and(
  z.object({
    version: z.number().int().nonnegative(),
    content: translatedContent,
  }),
);
export const translationLimits = {
  articleChars: 25000,
  fragmentChars: 3000,
  fragments: 240,
  requestChars: 4000,
  requestItems: 40,
  userRequests: 10,
  userChars: 50000,
  globalChars: 500000,
} as const;
export type TranslationError =
  | "invalid"
  | "access"
  | "login"
  | "changed"
  | "limit"
  | "busy"
  | "unavailable"
  | "structure"
  | "disabled";
export class TranslationFailure extends Error {
  constructor(public code: TranslationError) {
    super(code);
  }
}

export const translationCopy = {
  ru: {
    title: "Перевод статьи",
    original: "Открыть оригинал",
    source: "Исходный язык",
    target: "Язык перевода",
    show: "Выбрать языки",
    translate: "Перевести через Google",
    pending: "Переводим…",
    notice:
      "По нажатию текст статьи будет отправлен Google Translate. Оригинал останется без изменений.",
    machine: "Машинный перевод · Google Translate",
    machineStructure:
      "Переводчик изменил разметку. Такой результат не сохранён; оригинал остаётся доступен.",
    corrected: "Перевод с правками редактора",
    revision: "Версия оригинала",
    cached: "Перевод сохранён. Повторное открытие не отправляет текст заново.",
    empty: "Для этой версии статьи перевода пока нет.",
    login: "Войдите, чтобы запросить перевод",
    disabled: "Автоматический перевод отключён.",
    edit: "Уточнить перевод",
    titleField: "Заголовок перевода",
    summaryField: "Краткое описание",
    markdownField: "Текст перевода (Markdown)",
    editHint:
      "Можно исправлять текст. Ссылки, код, таблицы и структура должны сохраниться. Правки хранятся отдельно от оригинала и машинного перевода.",
    save: "Сохранить правки",
    saving: "Сохраняем…",
    saved: "Правки сохранены",
    machineVersion: "Показать машинную версию",
    sourceVersion: "Оригинал для сравнения",
    errors: {
      invalid: "Проверьте языки и заполненные поля.",
      access: "Статья недоступна или у вас нет прав.",
      login: "Для этого действия нужно войти.",
      changed:
        "Статья или перевод изменились. Обновите страницу перед повторной попыткой.",
      limit:
        "Достигнут лимит перевода. Максимум — 25 000 символов на статью и 10 запросов в день; действуют также общие квоты.",
      busy: "Перевод уже запущен или временно приостановлен после ошибки. Попробуйте через минуту.",
      unavailable:
        "Сервис перевода не ответил. Оригинал доступен; попробуйте позже.",
      structure:
        "Структура Markdown изменилась. Сохраните ссылки, код и разделители; исправляйте только текст.",
      disabled: "Автоматический перевод отключён.",
    },
  },
  en: {
    title: "Article translation",
    original: "View original",
    source: "Source language",
    target: "Target language",
    show: "Select languages",
    translate: "Translate with Google",
    pending: "Translating…",
    notice:
      "Clicking sends this article's text to Google Translate. The original stays unchanged.",
    machine: "Machine translation · Google Translate",
    machineStructure:
      "The provider changed the Markdown structure. This result was not saved; the original remains available.",
    corrected: "Translation with editor corrections",
    revision: "Source revision",
    cached: "Translation saved. Opening it again does not send the text again.",
    empty: "This article revision has not been translated yet.",
    login: "Sign in to request a translation",
    disabled: "Automatic translation is disabled.",
    edit: "Improve translation",
    titleField: "Translated title",
    summaryField: "Summary",
    markdownField: "Translated text (Markdown)",
    editHint:
      "Edit the wording while preserving links, code, tables and structure. Corrections are stored separately from the original and the machine translation.",
    save: "Save corrections",
    saving: "Saving…",
    saved: "Corrections saved",
    machineVersion: "Show machine version",
    sourceVersion: "Original for comparison",
    errors: {
      invalid: "Check languages and form fields.",
      access: "The article is unavailable or you lack permission.",
      login: "Sign in to continue.",
      changed:
        "The article or translation has changed. Reload before trying again.",
      limit:
        "Translation limit reached: up to 25,000 characters per article and 10 requests per day. Shared quotas also apply.",
      busy: "Translation is in progress or paused after a failure. Try again in a minute.",
      unavailable:
        "Translation service did not respond. The original is available; try again later.",
      structure:
        "Markdown structure changed. Preserve links, code and delimiters; edit only the wording.",
      disabled: "Automatic translation is disabled.",
    },
  },
} as const;
