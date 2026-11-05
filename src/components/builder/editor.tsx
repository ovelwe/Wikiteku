"use client";
import { type Data, Puck } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { useEffect, useMemo, useRef, useState } from "react";
import { CopyLink } from "@/components/copy-link";
import {
  type DesignDocument,
  type DesignTheme,
  describeDesignErrors,
  designSchema,
  fontFamilies,
  fontOptions,
  makeTemplate,
  themeSchema,
} from "@/lib/builder";
import { studioRu } from "@/lib/studio-ru";
import {
  type ArticleItem,
  type Blocks,
  type BuilderArticle,
  createBuilderConfig,
} from "./config";

type Version = {
  revision: number;
  document: DesignDocument;
  published: boolean;
};
export function DesignEditor({
  slug,
  title,
  description,
  initial,
  revision: initialRevision,
  history: initialHistory,
  articles,
  article,
}: {
  slug: string;
  title: string;
  description: string;
  initial: DesignDocument;
  revision: number;
  history: Version[];
  articles: ArticleItem[];
  article?: BuilderArticle & { id: string; slug: string };
}) {
  const [data, setData] = useState(
    () =>
      ({
        ...initial.data,
        root: {
          ...initial.data.root,
          props: themeSchema.parse(initial.data.root.props),
        },
      }) as Data<Blocks, DesignTheme>,
  );
  const [revision, setRevision] = useState(initialRevision);
  const [history, setHistory] = useState(initialHistory);
  const [generation, setGeneration] = useState(0);
  const [busy, setBusy] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [message, setMessage] = useState(
    "Черновик доступен только редакторам с соответствующими правами.",
  );
  const [error, setError] = useState(false);
  const [themeName, setThemeName] = useState("");
  const [themes, setThemes] = useState<{ name: string; theme: DesignTheme }[]>(
    [],
  );
  const [fontTarget, setFontTarget] = useState<"font" | "headingFont">(
    "headingFont",
  );
  const latestData = useRef(data);
  const saving = useRef(false);
  const config = useMemo(
    () => createBuilderConfig(articles, article),
    [articles, article],
  );
  useEffect(() => {
    fetch("/api/themes")
      .then((r) => (r.ok ? r.json() : null))
      .then((result) => {
        if (result) setThemes(result.themes);
      })
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  function replace(document: DesignDocument) {
    document = {
      ...document,
      data: {
        ...document.data,
        root: {
          ...document.data.root,
          props: themeSchema.parse(document.data.root.props),
        },
      },
    };
    latestData.current = document.data as Data<Blocks, DesignTheme>;
    setData(document.data as Data<Blocks, DesignTheme>);
    setGeneration((value) => value + 1);
    setDirty(true);
    setMessage(
      "Макет загружен в редактор. Сохраните черновик или опубликуйте.",
    );
  }
  function applyTheme(theme: DesignTheme) {
    replace({
      schemaVersion: 1,
      data: { ...data, root: { props: theme } },
    } as DesignDocument);
  }
  async function saveTheme() {
    if (saving.current) return;
    saving.current = true;
    setBusy(true);
    setError(false);
    try {
      const theme = data.root.props;
      const response = await fetch("/api/themes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: themeName, theme }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const list = await fetch("/api/themes").then((r) => r.json());
      setThemes(list.themes);
      setMessage(
        "Тема сохранена в вашу коллекцию. Теперь её можно применить к другому фандому.",
      );
    } catch (error) {
      setError(true);
      setMessage(
        error instanceof Error ? error.message : "Ошибка сохранения темы",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function save(publish: boolean) {
    if (saving.current) return;
    const document = designSchema.safeParse({ schemaVersion: 1, data });
    if (!document.success) {
      setError(true);
      setMessage(describeDesignErrors(document.error));
      return;
    }
    saving.current = true;
    setBusy(true);
    setError(false);
    try {
      const response = await fetch(
        article
          ? `/api/fandoms/${slug}/pages/${article.id}/design`
          : `/api/fandoms/${slug}/design`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ document: document.data, revision, publish }),
        },
      );
      const result = await response.json();
      if (!response.ok)
        throw new Error(result.error ?? "Не удалось сохранить макет");
      setRevision(result.revision);
      setDirty(JSON.stringify(latestData.current) !== JSON.stringify(data));
      setMessage(
        publish
          ? `Версия ${result.revision} опубликована.`
          : `Черновик ${result.revision} сохранён. Публичная страница не изменилась.`,
      );
      setHistory((old) =>
        [
          {
            revision: result.revision,
            document: document.data,
            published: publish,
          },
          ...old,
        ].slice(0, 10),
      );
    } catch (error) {
      setError(true);
      setMessage(
        error instanceof Error
          ? error.message
          : "Ошибка сети. Попробуйте ещё раз.",
      );
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="design-studio">
      <div className="studio-bar">
        <a href={article ? `/f/${slug}/wiki/${article.slug}` : `/f/${slug}`}>
          ← {title}
        </a>
        <strong>Студия оформления</strong>
        <CopyLink
          path={article ? `/f/${slug}/wiki/${article.slug}` : `/f/${slug}`}
        />
        <select
          aria-label="Готовый шаблон"
          value=""
          disabled={busy || !!article}
          onChange={(e) => {
            if (
              dirty &&
              !window.confirm(
                "Заменить несохранённый макет выбранным шаблоном?",
              )
            )
              return;
            replace(
              makeTemplate(
                e.target.value as DesignTheme["preset"],
                title,
                description,
              ),
            );
          }}
        >
          <option value="">Выбрать шаблон…</option>
          <option value="aurora">Графит</option>
          <option value="archive">Редакция</option>
          <option value="terminal">Система</option>
          <option value="gothic">Ателье</option>
        </select>
        <span role="status" className="studio-status" data-error={error}>
          {busy ? "Сохраняем…" : message}
          {dirty ? " • Есть изменения" : ""}
        </span>
      </div>
      <div className="studio-history">
        <span>Версии:</span>
        {history.length ? (
          history.map((v) => (
            <button
              className="studio-action"
              type="button"
              disabled={busy}
              key={v.revision}
              onClick={() => {
                if (
                  dirty &&
                  !window.confirm(
                    "Загрузить версию вместо несохранённых изменений?",
                  )
                )
                  return;
                replace(v.document);
              }}
            >
              №{v.revision}
              {v.published ? " · опубликована" : ""}
            </button>
          ))
        ) : (
          <span>Первая версия появится после сохранения.</span>
        )}
      </div>
      <details className="theme-library">
        <summary>Оформление · стили, шрифты и мои темы</summary>
        <p>
          Цвета, текстуры, размеры и шрифты настраиваются в разделе «Тема
          страницы». Сохраните сочетание под своим именем.
        </p>
        <div className="theme-library-controls">
          <input
            aria-label="Название моей темы"
            placeholder="Например: Мой журнал"
            maxLength={60}
            value={themeName}
            onChange={(e) => setThemeName(e.target.value)}
          />
          <button
            className="studio-action"
            type="button"
            disabled={busy || !themeName.trim()}
            onClick={saveTheme}
          >
            Сохранить мою тему
          </button>
          <select
            aria-label="Мои сохранённые темы"
            value=""
            disabled={busy}
            onChange={(e) => {
              const saved = themes.find((t) => t.name === e.target.value);
              if (saved) applyTheme(saved.theme);
            }}
          >
            <option value="">Применить мою тему…</option>
            {themes.map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>
        <section className="style-samples" aria-label="Готовые стили">
          {(
            [
              ["aurora", "Графит", "Чистая типографика и синий акцент"],
              ["archive", "Редакция", "Тёплая бумага и книжные шрифты"],
              ["terminal", "Система", "Точные линии и технический характер"],
              ["gothic", "Ателье", "Мягкие формы и выразительный заголовок"],
            ] as const
          ).map(([preset, name, caption]) => (
            <button
              type="button"
              key={preset}
              data-style={preset}
              disabled={busy}
              aria-pressed={data.root.props?.preset === preset}
              onClick={() =>
                applyTheme(
                  makeTemplate(preset, title, description).data.root.props,
                )
              }
            >
              <span className="style-preview">
                Аа <i /> <i />
              </span>
              <strong>{name}</strong>
              <small>{caption}</small>
            </button>
          ))}
        </section>
        <label className="font-target">
          Шрифт для
          <select
            value={fontTarget}
            onChange={(e) =>
              setFontTarget(e.target.value as "font" | "headingFont")
            }
          >
            <option value="headingFont">Заголовков</option>
            <option value="font">Основного текста</option>
          </select>
        </label>
        <div className="font-samples">
          {fontOptions.map((font) => (
            <button
              type="button"
              key={font.value}
              disabled={busy}
              aria-pressed={data.root.props?.[fontTarget] === font.value}
              style={{
                fontFamily: fontFamilies[font.value as DesignTheme["font"]],
              }}
              onClick={() =>
                applyTheme({
                  ...data.root.props,
                  [fontTarget]: font.value,
                } as DesignTheme)
              }
            >
              Мой мир<small>{font.label}</small>
            </button>
          ))}
        </div>
      </details>
      <div className="studio-mobile-note">
        Для удобной работы с колонками разверните редактор на большом экране.
      </div>
      <div className="studio-editor">
        <Puck
          key={generation}
          config={config}
          data={data}
          onChange={(value) => {
            latestData.current = value;
            setData(value);
            setDirty(true);
          }}
          headerTitle="Wikiteku Studio"
          headerPath={`/f/${slug}`}
          height="100%"
          dictionary={studioRu}
          viewports={[
            { width: 390, height: "auto", label: "Телефон" },
            { width: 768, height: "auto", label: "Планшет" },
            { width: 1280, height: "auto", label: "Компьютер" },
          ]}
          overrides={{
            headerActions: () => (
              <>
                <button
                  type="button"
                  className="studio-action"
                  disabled={busy}
                  onClick={() => save(false)}
                >
                  Сохранить черновик
                </button>
                <button
                  type="button"
                  className="studio-action publish"
                  disabled={busy}
                  onClick={() => save(true)}
                >
                  Опубликовать
                </button>
              </>
            ),
          }}
        />
      </div>
    </div>
  );
}
