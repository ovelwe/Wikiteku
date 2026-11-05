import { z } from "zod";
import { safeDesignUrl } from "./builder";

export const slugSchema = z
  .string()
  .trim()
  .toLowerCase()
  .min(3)
  .max(48)
  .regex(
    /^[a-z0-9](?:[a-z0-9-]{1,46}[a-z0-9])?$/,
    "Используйте 3–48 латинских букв, цифр и дефисов",
  );
export const usernameSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^[a-z0-9_]{3,24}$/, "Имя: 3–24 латинских букв, цифр или _");

export const tagsSchema = z
  .string()
  .max(500)
  .default("")
  .transform((value) => [
    ...new Set(
      value
        .split(",")
        .map((tag) => tag.trim().replace(/^#+/, "").toLowerCase())
        .filter(Boolean),
    ),
  ])
  .pipe(
    z
      .array(
        z
          .string()
          .max(40)
          .regex(/^[\p{L}\p{N} _-]+$/u, "Теги: буквы, цифры, пробелы и дефисы"),
      )
      .max(12),
  );

export const createFandomSchema = z.object({
  title: z.string().trim().min(3).max(100),
  slug: slugSchema,
  description: z.string().trim().min(10).max(2000),
  tags: tagsSchema,
  category: z.enum(["games", "films", "books", "series", "anime", "other"]),
  language: z.enum(["ru", "en"]),
  visibility: z.enum(["public", "unlisted", "private"]),
});

export const pageSchema = z.object({
  categories: tagsSchema,
  cover: z
    .string()
    .max(2000)
    .default("")
    .refine(
      (v) => safeDesignUrl(v, true),
      "Обложка: HTTPS или загруженное изображение",
    ),
  title: z.string().trim().min(2).max(160),
  slug: slugSchema,
  markdown: z.string().min(1).max(100_000),
  tags: tagsSchema,
  summary: z.string().trim().max(300),
  status: z.enum(["draft", "published"]),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80),
  bio: z.string().trim().max(1000),
});

export function validPage(value: string | undefined) {
  const parsed = Number(value ?? "1");
  return Number.isSafeInteger(parsed) && parsed > 0
    ? Math.min(parsed, 10000)
    : 1;
}
