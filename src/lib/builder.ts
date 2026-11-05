import { z } from "zod";

const text = z.string().max(12000);
const short = z.string().max(300);
export function safeDesignUrl(value: string, image = false) {
  if (!value) return true;
  if (/^\/api\/media\/[0-9a-f-]{36}$/.test(value)) return true;
  if (!image && /^\/(?!\/|\\)/.test(value) && !value.includes("\\"))
    return true;
  if (!image && /^#[a-zA-Z0-9_-]+$/.test(value)) return true;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
const href = z
  .string()
  .max(2000)
  .refine((v) => safeDesignUrl(v), "Используйте HTTPS или внутреннюю ссылку");
const imageUrl = z
  .string()
  .max(2000)
  .refine((v) => safeDesignUrl(v, true), "Для изображения нужен HTTPS");
const align = z.enum(["left", "center", "right"]);
export const fontNames = [
  "manrope",
  "onest",
  "inter",
  "golos",
  "geologica",
  "montserrat",
  "nunito",
  "rubik",
  "lora",
  "literata",
  "plex",
  "ptserif",
  "sans",
  "serif",
  "mono",
  "unbounded",
  "pixel",
  "caveat",
  "russo",
  "glitch",
  "bubbles",
  "paint",
  "rubikMono",
] as const;
export const fontOptions = [
  { label: "Manrope · Современный", value: "manrope" },
  { label: "Onest · Универсальный", value: "onest" },
  { label: "Inter · Интерфейсный", value: "inter" },
  { label: "Golos Text · Читаемый", value: "golos" },
  { label: "Geologica · Геометричный", value: "geologica" },
  { label: "Montserrat · Выразительный", value: "montserrat" },
  { label: "Nunito Sans · Мягкий", value: "nunito" },
  { label: "Rubik · Дружелюбный", value: "rubik" },
  { label: "Lora · Литературный", value: "lora" },
  { label: "Literata · Редакционный", value: "literata" },
  { label: "IBM Plex Mono · Технический", value: "plex" },
  { label: "PT Serif · Классический", value: "ptserif" },
  { label: "Unbounded · Футуристичный", value: "unbounded" },
  { label: "Caveat · Рукописный", value: "caveat" },
  { label: "Press Start 2P · Пиксельный", value: "pixel" },
];
export const fontFamilies: Record<(typeof fontNames)[number], string> = {
  manrope: '"Manrope Variable",sans-serif',
  onest: '"Onest Variable",sans-serif',
  inter: '"Inter Variable",sans-serif',
  golos: '"Golos Text Variable",sans-serif',
  geologica: '"Geologica Variable",sans-serif',
  montserrat: '"Montserrat Variable",sans-serif',
  nunito: '"Nunito Sans Variable",sans-serif',
  rubik: '"Rubik Variable",sans-serif',
  lora: '"Lora Variable",serif',
  literata: '"Literata Variable",serif',
  plex: '"IBM Plex Mono",monospace',
  ptserif: '"PT Serif",serif',
  sans: '"Segoe UI",Arial,sans-serif',
  serif: 'Georgia,"Times New Roman",serif',
  mono: '"Cascadia Code",Consolas,monospace',
  unbounded: '"Unbounded",sans-serif',
  pixel: '"Press Start 2P",monospace',
  caveat: '"Caveat",cursive',
  russo: '"Russo One",sans-serif',
  glitch: '"Rubik Glitch",sans-serif',
  bubbles: '"Rubik Bubbles",cursive',
  paint: '"Rubik Wet Paint",cursive',
  rubikMono: '"Rubik Mono One",monospace',
};
const colorOverride = z
  .string()
  .regex(/^(#[0-9a-fA-F]{6})?$/)
  .default("");
export const themeSchema = z
  .object({
    preset: z.enum(["aurora", "archive", "terminal", "gothic"]),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    font: z.enum(fontNames),
    headingFont: z.enum(fontNames).default("sans"),
    background: colorOverride,
    backgroundImage: imageUrl.default(""),
    surface: colorOverride,
    foreground: colorOverride,
    muted: colorOverride,
    border: colorOverride,
    texture: z.enum(["none", "grid", "dots", "lines"]).default("none"),
    width: z.number().min(320).max(1440),
    spacing: z.number().min(8).max(80),
    radius: z.number().min(0).max(32),
    motion: z.enum(["on", "off"]),
  })
  .strict();
export type DesignTheme = z.infer<typeof themeSchema>;
export const defaultTheme: DesignTheme = {
  preset: "aurora",
  accent: "#85aaff",
  font: "onest",
  headingFont: "manrope",
  background: "",
  backgroundImage: "",
  surface: "",
  foreground: "",
  muted: "",
  border: "",
  texture: "none",
  width: 1120,
  spacing: 32,
  radius: 16,
  motion: "on",
};
const item = z.object({ label: short, value: text }).strict();
const link = z.object({ label: short, href }).strict();
const shapes = {
  ArticleBody: z.object({}),
  Hero: z.object({ title: short, subtitle: text, label: short, href, align }),
  Text: z.object({ title: short, body: text, align }),
  Markdown: z.object({ markdown: text }),
  Image: z.object({ src: imageUrl, alt: short, caption: short }),
  Gallery: z.object({
    images: z.array(z.object({ src: imageUrl, alt: short }).strict()).max(12),
  }),
  Button: z.object({ label: short, href, align }),
  Character: z.object({ name: short, role: short, bio: text, image: imageUrl }),
  Infobox: z.object({ title: short, items: z.array(item).max(30) }),
  Navigation: z.object({ links: z.array(link).max(20) }),
  Related: z.object({ title: short, links: z.array(link).max(20) }),
  Articles: z.object({ title: short, limit: z.number().int().min(1).max(30) }),
  Quote: z.object({ text, author: short }),
  Video: z.object({
    provider: z.enum(["youtube", "vimeo"]),
    videoId: z.string().regex(/^[a-zA-Z0-9_-]{0,30}$/),
    title: short,
  }),
  Divider: z.object({ space: z.number().min(8).max(160) }),
  Decoration: z.object({
    symbol: z.enum(["✦", "◎", "✳", "◇"]),
    size: z.number().min(24).max(180),
  }),
  Timeline: z.object({ title: short, events: z.array(item).max(30) }),
};
type LayoutBlock = { type: string; props: Record<string, unknown> };
const blockSchema: z.ZodType<LayoutBlock> = z.lazy(() =>
  z
    .object({
      type: z.string(),
      props: z.record(z.string(), z.unknown()),
      readOnly: z.record(z.string(), z.boolean()).optional(),
    })
    .strict()
    .superRefine((block, ctx) => {
      const base = { id: z.string().min(1).max(100) };
      const schema =
        block.type === "Grid"
          ? z
              .object({
                ...base,
                columns: z.enum(["1", "2", "3"]),
                gap: z.number().min(0).max(80),
                padding: z.number().min(0).max(100),
                content: z.array(blockSchema).max(60),
              })
              .strict()
          : Object.hasOwn(shapes, block.type)
            ? shapes[block.type as keyof typeof shapes].extend(base).strict()
            : null;
      if (!schema) {
        ctx.addIssue({
          code: "custom",
          message: `Неизвестный блок ${block.type}`,
        });
        return;
      }
      const result = schema.safeParse(block.props);
      if (!result.success)
        for (const issue of result.error.issues)
          ctx.addIssue({
            code: "custom",
            path: ["props", ...issue.path],
            message: issue.message,
          });
    }),
);
export const designSchema = z
  .object({
    schemaVersion: z.literal(1),
    data: z
      .object({
        root: z
          .object({
            props: themeSchema,
            readOnly: z.record(z.string(), z.boolean()).optional(),
          })
          .strict(),
        content: z.array(blockSchema).max(80),
        // Puck adds an empty legacy zones map after insertion; Slot content lives in props.
        zones: z.object({}).strict().optional(),
      })
      .strict(),
  })
  .strict()
  .superRefine((doc, ctx) => {
    let count = 0;
    const ids = new Set<string>();
    const visit = (blocks: LayoutBlock[], depth: number) => {
      if (depth > 6) {
        ctx.addIssue({
          code: "custom",
          message: "Не более 6 уровней вложенности",
        });
        return;
      }
      for (const block of blocks) {
        count++;
        const id = String(block.props.id);
        if (ids.has(id))
          ctx.addIssue({ code: "custom", message: "Повторяющийся ID блока" });
        ids.add(id);
        if (block.type === "Grid" && Array.isArray(block.props.content))
          visit(block.props.content as LayoutBlock[], depth + 1);
      }
    };
    visit(doc.data.content, 0);
    if (count > 100)
      ctx.addIssue({ code: "custom", message: "Не более 100 блоков" });
  });
export type DesignDocument = z.infer<typeof designSchema>;
export function describeDesignErrors(error: z.ZodError): string {
  const labels: Record<string, string> = {
    root: "Тема страницы",
    background: "Фон",
    accent: "Акцент",
    href: "Ссылка",
    src: "Изображение",
    title: "Заголовок",
    width: "Ширина",
    spacing: "Отступы",
    radius: "Скругление",
    content: "Блок",
    props: "",
    data: "",
    document: "",
  };
  return error.issues
    .slice(0, 8)
    .map((issue) => {
      const path = issue.path
        .map((part) =>
          typeof part === "number"
            ? String(part + 1)
            : (labels[String(part)] ?? String(part)),
        )
        .filter(Boolean)
        .join(" → ");
      const reason =
        issue.code === "invalid_format"
          ? "Неверный формат значения"
          : issue.code === "invalid_type"
            ? "Заполните поле значением нужного типа"
            : issue.code === "too_big"
              ? "Значение превышает допустимый размер"
              : issue.code === "too_small"
                ? "Значение меньше допустимого"
                : issue.code === "unrecognized_keys"
                  ? `Неизвестные поля: ${issue.keys.join(", ")}`
                  : issue.message;
      return `${path || "Макет"}: ${reason}`;
    })
    .join("; ");
}
export const saveDesignSchema = z
  .object({
    document: designSchema,
    revision: z.number().int().nonnegative(),
    publish: z.boolean(),
  })
  .strict();
export function makeTemplate(
  preset: DesignTheme["preset"],
  title: string,
  description: string,
): DesignDocument {
  const themes: Record<DesignTheme["preset"], Partial<DesignTheme>> = {
    aurora: { headingFont: "manrope", font: "onest", accent: "#85aaff" },
    archive: {
      accent: "#765438",
      font: "literata",
      headingFont: "lora",
      radius: 6,
    },
    terminal: {
      accent: "#acd9c1",
      font: "plex",
      headingFont: "geologica",
      radius: 8,
    },
    gothic: {
      accent: "#d1baff",
      font: "inter",
      headingFont: "unbounded",
      radius: 24,
    },
  };
  return {
    schemaVersion: 1,
    data: {
      root: { props: { ...defaultTheme, ...themes[preset], preset } },
      content: [
        {
          type: "Hero",
          props: {
            id: "hero",
            title,
            subtitle: description,
            label: "К статьям",
            href: "#articles",
            align: preset === "gothic" ? "center" : "left",
          },
        },
        {
          type: "Navigation",
          props: {
            id: "navigation",
            links: [{ label: "Энциклопедия", href: "#articles" }],
          },
        },
        {
          type: "Text",
          props: {
            id: "welcome",
            title: "Добро пожаловать в наш мир",
            body: "Здесь начинается история вашего сообщества. Добавьте правила, расскажите о вселенной и пригласите читателей исследовать её вместе.",
            align: "left",
          },
        },
        {
          type: "Articles",
          props: {
            id: "articles-list",
            title: "Исследуйте энциклопедию",
            limit: 6,
          },
        },
      ],
    },
  };
}
