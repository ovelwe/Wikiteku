import { z } from "zod";

export const reportInput = z
  .object({
    pageId: z.string().uuid(),
    revision: z.number().int().positive(),
    reason: z.enum(["spam", "abuse", "personal_data", "other"]),
    details: z.string().trim().min(10).max(3000),
  })
  .strict();
export const decisionInput = z
  .object({
    reportId: z.string().uuid(),
    action: z.enum(["dismiss", "block", "unblock"]),
    revision: z.number().int().nonnegative(),
    pageRevision: z.number().int().positive(),
    note: z.string().trim().min(10).max(1000),
  })
  .strict();

export class ModerationFailure extends Error {
  constructor(
    public status: number,
    public code: "access" | "changed" | "limit",
  ) {
    super(code);
  }
}

export const moderationCopy = {
  ru: {
    report: "Пожаловаться",
    mine: "Мои обращения",
    queue: "Модерация",
    heading: "Жалоба на статью",
    notice:
      "Обращение и копию текста получат модераторы платформы. Не добавляйте лишние личные данные. До 10 новых обращений в день.",
    reason: "Причина",
    reasons: {
      spam: "Спам",
      abuse: "Оскорбления или травля",
      personal_data: "Раскрытие личных данных",
      other: "Другое",
    },
    details: "Что нарушено?",
    help: "Опишите проблему и укажите фрагмент статьи (10–3000 символов).",
    send: "Отправить жалобу",
    pending: "Сохраняем…",
    open: "На рассмотрении",
    resolved: "Рассмотрено",
    empty: "Здесь пока нет обращений.",
    dismiss: "Отклонить жалобу",
    decisions: {
      dismiss: "Жалоба отклонена",
      block: "Статья заблокирована",
      unblock: "Блокировка снята",
    },
    block: "Заблокировать статью",
    unblock: "Снять блокировку",
    note: "Обоснование решения",
    noteHelp: "От 10 до 1000 символов. Сохранится в журнале модерации.",
    snapshot: "Текст при отправке жалобы",
    current: "Текущий текст",
    audit: "Журнал решений по статье",
    blocked: "Статья заблокирована",
    available: "Статья не заблокирована",
    editNotice:
      "Статья скрыта модератором платформы. Вы можете исправить текст; публикация и восстановление версии не снимают блокировку.",
    confirm: "Подтверждаю изменение доступности статьи",
    back: "Назад",
    next: "Дальше",
    revision: "Версия",
    result: "Решение",
    saved: "Решение сохранено",
    errors: {
      access: "Нет доступа к этому действию или статья недоступна.",
      changed:
        "Статья или решение изменились. Обновите страницу перед повтором.",
      limit: "Дневной лимит обращений исчерпан. Попробуйте завтра.",
      invalid: "Проверьте причину и длину пояснения.",
      unavailable: "Не удалось сохранить. Попробуйте ещё раз.",
    },
  },
  en: {
    report: "Report",
    mine: "My reports",
    queue: "Moderation",
    heading: "Report an article",
    notice:
      "Platform moderators will receive your report and a copy of the text. Avoid unnecessary personal data. Up to 10 new reports per day.",
    reason: "Reason",
    reasons: {
      spam: "Spam",
      abuse: "Abuse or harassment",
      personal_data: "Personal data exposure",
      other: "Other",
    },
    details: "What is wrong?",
    help: "Describe the issue and identify the passage (10–3000 characters).",
    send: "Submit report",
    pending: "Saving…",
    open: "Pending",
    resolved: "Reviewed",
    empty: "No reports here yet.",
    dismiss: "Dismiss report",
    decisions: {
      dismiss: "Report dismissed",
      block: "Article blocked",
      unblock: "Article unblocked",
    },
    block: "Block article",
    unblock: "Unblock article",
    note: "Decision explanation",
    noteHelp: "10–1000 characters. Recorded in the moderation log.",
    snapshot: "Text when reported",
    current: "Current text",
    audit: "Article decision history",
    blocked: "Article blocked",
    available: "Article not blocked",
    editNotice:
      "A platform moderator has hidden this article. You can edit it; publishing or restoring a revision does not remove the block.",
    confirm: "I confirm changing article availability",
    back: "Back",
    next: "Next",
    revision: "Revision",
    result: "Decision",
    saved: "Decision saved",
    errors: {
      access: "You cannot perform this action or the article is unavailable.",
      changed: "The article or decision changed. Reload before trying again.",
      limit: "Daily report limit reached. Try again tomorrow.",
      invalid: "Check the reason and explanation length.",
      unavailable: "Could not save. Please try again.",
    },
  },
} as const;
