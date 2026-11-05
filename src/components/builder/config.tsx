/* biome-ignore-all lint/suspicious/noArrayIndexKey: Stateless render-only array items may have duplicate user labels and URLs. */
"use client";
import { type Config, type Data, Render, type Slot } from "@puckeditor/core";
import type { CSSProperties } from "react";
import type { DesignDocument, DesignTheme } from "@/lib/builder";
import {
  fontFamilies,
  fontNames,
  fontOptions,
  safeDesignUrl,
} from "@/lib/builder";
import { MarkdownRenderer } from "@/lib/markdown";
import "./canvas.css";
import "./fonts.css";

type Item = { label: string; value: string };
type LinkItem = { label: string; href: string };
export type Blocks = {
  ArticleBody: Record<string, never>;
  Hero: {
    title: string;
    subtitle: string;
    label: string;
    href: string;
    align: "left" | "center" | "right";
  };
  Text: { title: string; body: string; align: "left" | "center" | "right" };
  Markdown: { markdown: string };
  Image: { src: string; alt: string; caption: string };
  Gallery: { images: { src: string; alt: string }[] };
  Button: { label: string; href: string; align: "left" | "center" | "right" };
  Character: { name: string; role: string; bio: string; image: string };
  Infobox: { title: string; items: Item[] };
  Grid: {
    columns: "1" | "2" | "3";
    gap: number;
    padding: number;
    content: Slot;
  };
  Navigation: { links: LinkItem[] };
  Related: { title: string; links: LinkItem[] };
  Articles: { title: string; limit: number };
  Quote: { text: string; author: string };
  Video: { provider: "youtube" | "vimeo"; videoId: string; title: string };
  Divider: { space: number };
  Decoration: { symbol: "✦" | "◎" | "✳" | "◇"; size: number };
  Timeline: { title: string; events: Item[] };
};
export type ArticleItem = { title: string; summary: string; href: string };
// Keep legacy selections visible instead of displaying the first new option.
const compatibleFontOptions = [
  ...fontOptions,
  ...fontNames
    .filter((value) => !fontOptions.some((option) => option.value === value))
    .map((value) => ({
      value,
      label: `${fontFamilies[value].split(",")[0].replaceAll('"', "")} · прежняя коллекция`,
    })),
];
const textField = { type: "text" } as const;
const longField = { type: "textarea" } as const;
const alignment = {
  type: "radio",
  label: "Выравнивание",
  options: [
    { label: "Слева", value: "left" },
    { label: "По центру", value: "center" },
    { label: "Справа", value: "right" },
  ],
} as const;
const linkFields = {
  label: { ...textField, label: "Подпись" },
  href: { ...textField, label: "Ссылка" },
};
const safeLink = (href: string) =>
  safeDesignUrl(href) && href ? href : undefined;
function Media({ src, alt }: { src: string; alt: string }) {
  // Remote user media is rendered directly in the browser, never fetched by the server.
  return src && safeDesignUrl(src, true) ? (
    // biome-ignore lint/performance/noImgElement: User media must not be fetched through a server image proxy.
    <img src={src} alt={alt} loading="lazy" referrerPolicy="no-referrer" />
  ) : (
    <div className="canvas-placeholder">
      Добавьте HTTPS-ссылку на изображение
    </div>
  );
}
export function createBuilderConfig(
  articles: ArticleItem[],
  article?: { markdown: string; fandomSlug: string },
): Config<Blocks, DesignTheme> {
  return {
    root: {
      fields: {
        preset: {
          type: "select",
          label: "Тема",
          options: [
            { label: "Графит", value: "aurora" },
            { label: "Редакция", value: "archive" },
            { label: "Система", value: "terminal" },
            { label: "Ателье", value: "gothic" },
          ],
        },
        accent: { ...textField, label: "Акцент (#RRGGBB)" },
        font: {
          type: "select",
          label: "Шрифт текста",
          options: compatibleFontOptions,
        },
        headingFont: {
          type: "select",
          label: "Шрифт заголовков",
          options: compatibleFontOptions,
        },
        background: {
          ...textField,
          label: "Цвет фона (#RRGGBB, пусто — из темы)",
        },
        backgroundImage: { ...textField, label: "Фоновое изображение (HTTPS)" },
        surface: { ...textField, label: "Цвет карточек" },
        foreground: { ...textField, label: "Цвет заголовков" },
        muted: { ...textField, label: "Цвет текста" },
        border: { ...textField, label: "Цвет рамок" },
        texture: {
          type: "select",
          label: "Текстура",
          options: [
            { label: "Нет", value: "none" },
            { label: "Сетка", value: "grid" },
            { label: "Точки", value: "dots" },
            { label: "Строки терминала", value: "lines" },
          ],
        },
        width: {
          type: "number",
          label: "Максимальная ширина",
          min: 320,
          max: 1440,
        },
        spacing: { type: "number", label: "Отступы", min: 8, max: 80 },
        radius: { type: "number", label: "Скругление", min: 0, max: 32 },
        motion: {
          type: "radio",
          label: "Анимация",
          options: [
            { label: "Включена", value: "on" },
            { label: "Выключена", value: "off" },
          ],
        },
      },
      render: ({ children, ...theme }) => (
        <CanvasTheme theme={theme}>{children}</CanvasTheme>
      ),
    },
    categories: {
      layout: {
        title: "Композиция",
        components: ["Hero", "Grid", "Navigation", "Divider", "Decoration"],
      },
      content: {
        title: "Контент",
        components: [
          "Text",
          "Markdown",
          "Image",
          "Gallery",
          "Button",
          "Quote",
          "Video",
        ],
      },
      wiki: {
        title: "Энциклопедия",
        components: [
          "Character",
          "Infobox",
          "Articles",
          "Related",
          "Timeline",
          ...(article ? ["ArticleBody" as const] : []),
        ],
      },
    },
    components: {
      ArticleBody: {
        label: "Текст статьи и оглавление",
        defaultProps: {},
        render: () => (
          <section className="canvas-block">
            {article ? (
              <MarkdownRenderer
                markdown={article.markdown}
                fandomSlug={article.fandomSlug}
                toc
              />
            ) : (
              <p>Текст доступен в оформлении статьи.</p>
            )}
          </section>
        ),
      },
      Hero: {
        label: "Обложка",
        fields: {
          title: { ...textField, label: "Заголовок" },
          subtitle: { ...longField, label: "Описание" },
          ...linkFields,
          align: alignment,
        },
        defaultProps: {
          title: "Ваша вселенная",
          subtitle: "У каждого мира есть история.",
          label: "Исследовать",
          href: "#articles",
          align: "left",
        },
        render: ({ title, subtitle, label, href, align }) => (
          <section className="canvas-hero" style={{ textAlign: align }}>
            <span className="canvas-kicker">ДОБРО ПОЖАЛОВАТЬ ВО ВСЕЛЕННУЮ</span>
            <h1>{title}</h1>
            <p>{subtitle}</p>
            {label && (
              <a className="canvas-button" href={safeLink(href)}>
                {label} ↗
              </a>
            )}
            <span className="canvas-orbit" aria-hidden="true" />
          </section>
        ),
      },
      Text: {
        label: "Заголовок и текст",
        fields: {
          title: { ...textField, label: "Заголовок" },
          body: { ...longField, label: "Текст" },
          align: alignment,
        },
        defaultProps: {
          title: "Новая глава",
          body: "Расскажите свою историю.",
          align: "left",
        },
        render: ({ title, body, align }) => (
          <section className="canvas-block" style={{ textAlign: align }}>
            <h2>{title}</h2>
            <p className="canvas-prose">{body}</p>
          </section>
        ),
      },
      Markdown: {
        label: "Markdown",
        fields: { markdown: { ...longField, label: "Markdown" } },
        defaultProps: {
          markdown: "## История мира\n\nНачните с **главного**.",
        },
        render: ({ markdown }) => (
          <section className="canvas-block">
            <MarkdownRenderer markdown={markdown} />
          </section>
        ),
      },
      Image: {
        label: "Изображение",
        fields: {
          src: { ...textField, label: "HTTPS-ссылка" },
          alt: { ...textField, label: "Описание для доступности" },
          caption: { ...textField, label: "Подпись" },
        },
        defaultProps: { src: "", alt: "", caption: "" },
        render: ({ src, alt, caption }) => (
          <figure className="canvas-block canvas-image">
            <Media src={src} alt={alt} />
            {caption && <figcaption>{caption}</figcaption>}
          </figure>
        ),
      },
      Gallery: {
        label: "Галерея",
        fields: {
          images: {
            type: "array",
            label: "Изображения",
            arrayFields: {
              src: { ...textField, label: "HTTPS-ссылка" },
              alt: { ...textField, label: "Описание" },
            },
            defaultItemProps: { src: "", alt: "" },
          },
        },
        defaultProps: { images: [] },
        render: ({ images }) => (
          <div className="canvas-block canvas-gallery">
            {images.length ? (
              images.map((img, index) => (
                <Media key={`${img.src}-${index}`} {...img} />
              ))
            ) : (
              <p>Добавьте изображения в настройках галереи.</p>
            )}
          </div>
        ),
      },
      Button: {
        label: "Кнопка / ссылка",
        fields: { ...linkFields, align: alignment },
        defaultProps: {
          label: "Узнать больше",
          href: "/explore",
          align: "left",
        },
        render: ({ label, href, align }) => (
          <div className="canvas-block" style={{ textAlign: align }}>
            <a className="canvas-button" href={safeLink(href)}>
              {label} ↗
            </a>
          </div>
        ),
      },
      Character: {
        label: "Карточка персонажа",
        fields: {
          name: { ...textField, label: "Имя" },
          role: { ...textField, label: "Роль" },
          bio: { ...longField, label: "Описание" },
          image: { ...textField, label: "Изображение (HTTPS)" },
        },
        defaultProps: {
          name: "Имя персонажа",
          role: "Роль в истории",
          bio: "Расскажите о персонаже.",
          image: "",
        },
        render: ({ name, role, bio, image }) => (
          <article className="canvas-block canvas-character">
            {image && <Media src={image} alt={name} />}
            <span className="canvas-kicker">{role}</span>
            <h2>{name}</h2>
            <p>{bio}</p>
          </article>
        ),
      },
      Infobox: {
        label: "Информационный блок",
        fields: {
          title: { ...textField, label: "Заголовок" },
          items: {
            type: "array",
            label: "Факты",
            arrayFields: {
              label: { ...textField, label: "Название" },
              value: { ...longField, label: "Значение" },
            },
            defaultItemProps: { label: "Параметр", value: "Значение" },
          },
        },
        defaultProps: {
          title: "Досье",
          items: [{ label: "Статус", value: "Известен" }],
        },
        render: ({ title, items }) => (
          <section className="canvas-block canvas-infobox">
            <h2>{title}</h2>
            <dl>
              {items.map((item, index) => (
                <div key={`${item.label}-${index}`}>
                  <dt>{item.label}</dt>
                  <dd>{item.value}</dd>
                </div>
              ))}
            </dl>
          </section>
        ),
      },
      Grid: {
        label: "Секция / колонки",
        fields: {
          columns: {
            type: "radio",
            label: "Колонки",
            options: [
              { label: "1", value: "1" },
              { label: "2", value: "2" },
              { label: "3", value: "3" },
            ],
          },
          gap: { type: "number", label: "Расстояние", min: 0, max: 80 },
          padding: { type: "number", label: "Отступ внутри", min: 0, max: 100 },
          content: { type: "slot" },
        },
        defaultProps: { columns: "2", gap: 20, padding: 0, content: [] },
        render: ({ columns, gap, padding, content: Content }) => (
          <div className="canvas-block canvas-grid-shell" style={{ padding }}>
            <Content
              style={{
                display: "grid",
                gridTemplateColumns: `repeat(${columns},minmax(0,1fr))`,
                gap,
              }}
              className="canvas-grid"
            />
          </div>
        ),
      },
      Navigation: {
        label: "Навигация",
        fields: {
          links: {
            type: "array",
            label: "Ссылки",
            arrayFields: linkFields,
            defaultItemProps: { label: "Раздел", href: "#articles" },
          },
        },
        defaultProps: { links: [{ label: "Статьи", href: "#articles" }] },
        render: ({ links }) => (
          <nav
            className="canvas-block canvas-nav"
            aria-label="Навигация фандома"
          >
            {links.map((link, index) => (
              <a key={`${link.label}-${index}`} href={safeLink(link.href)}>
                {link.label} ↗
              </a>
            ))}
          </nav>
        ),
      },
      Related: {
        label: "Связанные материалы",
        fields: {
          title: { ...textField, label: "Заголовок" },
          links: {
            type: "array",
            label: "Материалы",
            arrayFields: linkFields,
            defaultItemProps: { label: "Материал", href: "/explore" },
          },
        },
        defaultProps: { title: "Читайте также", links: [] },
        render: ({ title, links }) => (
          <section className="canvas-block">
            <h2>{title}</h2>
            {links.map((link, index) => (
              <a
                className="canvas-article"
                key={`${link.label}-${index}`}
                href={safeLink(link.href)}
              >
                {link.label} ↗
              </a>
            ))}
          </section>
        ),
      },
      Articles: {
        label: "Список статей",
        fields: {
          title: { ...textField, label: "Заголовок" },
          limit: { type: "number", label: "Количество", min: 1, max: 30 },
        },
        defaultProps: { title: "Энциклопедия", limit: 6 },
        render: ({ title, limit }) => (
          <section className="canvas-block" id="articles">
            <h2>{title}</h2>
            {articles.length ? (
              articles.slice(0, limit).map((article) => (
                <a
                  className="canvas-article"
                  key={article.href}
                  href={article.href}
                >
                  <strong>{article.title} ↗</strong>
                  <p>{article.summary}</p>
                </a>
              ))
            ) : (
              <p>Опубликованные статьи появятся здесь.</p>
            )}
          </section>
        ),
      },
      Quote: {
        label: "Цитата",
        fields: {
          text: { ...longField, label: "Цитата" },
          author: { ...textField, label: "Автор" },
        },
        defaultProps: { text: "У каждого мира есть история.", author: "" },
        render: ({ text, author }) => (
          <blockquote className="canvas-block canvas-quote">
            <p>«{text}»</p>
            {author && <cite>— {author}</cite>}
          </blockquote>
        ),
      },
      Video: {
        label: "Видео",
        fields: {
          provider: {
            type: "select",
            label: "Платформа",
            options: [
              { label: "YouTube", value: "youtube" },
              { label: "Vimeo", value: "vimeo" },
            ],
          },
          videoId: { ...textField, label: "ID видео" },
          title: { ...textField, label: "Название" },
        },
        defaultProps: { provider: "youtube", videoId: "", title: "Видео" },
        render: ({ provider, videoId, title }) => (
          <section className="canvas-block">
            {videoId && /^[a-zA-Z0-9_-]{1,30}$/.test(videoId) ? (
              <iframe
                className="canvas-video"
                title={title}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin allow-presentation"
                allowFullScreen
                referrerPolicy="no-referrer"
                src={
                  provider === "youtube"
                    ? `https://www.youtube-nocookie.com/embed/${videoId}`
                    : `https://player.vimeo.com/video/${videoId}`
                }
              />
            ) : (
              <div className="canvas-placeholder">Укажите ID видео</div>
            )}
          </section>
        ),
      },
      Divider: {
        label: "Разделитель",
        fields: {
          space: { type: "number", label: "Высота", min: 8, max: 160 },
        },
        defaultProps: { space: 40 },
        render: ({ space }) => (
          <div className="canvas-divider" style={{ paddingBlock: space / 2 }}>
            <hr />
          </div>
        ),
      },
      Decoration: {
        label: "Декоративный знак",
        fields: {
          symbol: {
            type: "radio",
            label: "Символ",
            options: ["✦", "◎", "✳", "◇"].map((value) => ({
              label: value,
              value,
            })),
          },
          size: { type: "number", label: "Размер", min: 24, max: 180 },
        },
        defaultProps: { symbol: "✳", size: 80 },
        render: ({ symbol, size }) => (
          <div
            className="canvas-decoration"
            style={{ fontSize: size }}
            aria-hidden="true"
          >
            {symbol}
          </div>
        ),
      },
      Timeline: {
        label: "Таймлайн",
        fields: {
          title: { ...textField, label: "Заголовок" },
          events: {
            type: "array",
            label: "События",
            arrayFields: {
              label: { ...textField, label: "Дата / эпоха" },
              value: { ...longField, label: "Событие" },
            },
            defaultItemProps: { label: "Год", value: "Событие" },
          },
        },
        defaultProps: {
          title: "Хронология",
          events: [{ label: "Начало", value: "Здесь начинается история." }],
        },
        render: ({ title, events }) => (
          <section className="canvas-block">
            <h2>{title}</h2>
            <ol className="canvas-timeline">
              {events.map((event, index) => (
                <li key={`${event.label}-${index}`}>
                  <strong>{event.label}</strong>
                  <p>{event.value}</p>
                </li>
              ))}
            </ol>
          </section>
        ),
      },
    },
  };
}
export function CanvasTheme({
  theme,
  children,
}: {
  theme: DesignTheme;
  children: React.ReactNode;
}) {
  const overrides: Record<string, string> = {};
  for (const [key, value] of Object.entries({
    bg: theme.background,
    surface: theme.surface,
    text: theme.foreground,
    muted: theme.muted,
    border: theme.border,
  }))
    if (value && /^#[\da-f]{6}$/i.test(value))
      overrides[`--canvas-${key}`] = value;
  const style = {
    ...overrides,
    ...(theme.backgroundImage && safeDesignUrl(theme.backgroundImage, true)
      ? {
          backgroundImage: `url(${JSON.stringify(theme.backgroundImage)})`,
          backgroundSize: "cover",
          backgroundPosition: "center",
        }
      : {}),
    "--canvas-heading-font": fontFamilies[theme.headingFont],
    "--canvas-accent": /^#[\da-f]{6}$/i.test(theme.accent)
      ? theme.accent
      : "#b0ffbd",
    "--canvas-width": `${theme.width}px`,
    "--canvas-space": `${theme.spacing}px`,
    "--canvas-radius": `${theme.radius}px`,
    fontFamily: fontFamilies[theme.font],
  } as CSSProperties;
  return (
    <div
      className="fandom-canvas"
      data-preset={theme.preset}
      data-texture={theme.texture}
      data-motion={theme.motion}
      style={style}
    >
      <div className="canvas-inner">{children}</div>
    </div>
  );
}
export function DesignRenderer({
  document,
  articles,
  article,
}: {
  document: DesignDocument;
  articles: ArticleItem[];
  article?: { markdown: string; fandomSlug: string };
}) {
  return (
    <div className="published-world">
      <div
        className="world-backdrop"
        aria-hidden="true"
        style={{
          backgroundColor:
            document.data.root.props.background ||
            {
              aurora: "#111216",
              archive: "#f4f0e8",
              terminal: "#111b18",
              gothic: "#1b1825",
            }[document.data.root.props.preset],
          backgroundImage:
            document.data.root.props.backgroundImage &&
            safeDesignUrl(document.data.root.props.backgroundImage, true)
              ? `url(${JSON.stringify(document.data.root.props.backgroundImage)})`
              : undefined,
        }}
      />
      <Render
        config={createBuilderConfig(articles, article)}
        data={document.data as Data<Blocks, DesignTheme>}
      />
    </div>
  );
}
