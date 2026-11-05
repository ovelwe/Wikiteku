import Link from "next/link";
import { notFound } from "next/navigation";
import {
  TranslationCorrection,
  TranslationRequest,
} from "@/components/translation-controls";
import type { Locale } from "@/lib/i18n";
import { MarkdownRenderer } from "@/lib/markdown";
import { canEditContent } from "@/lib/permissions";
import { translationCopy, translationPair } from "@/lib/translation";
import { getLocale } from "@/server/community";
import { translationEnabled } from "@/server/translation-provider";
import { readTranslation, translationContext } from "@/server/translations";

export async function generateMetadata() {
  return {
    title: translationCopy[await getLocale()].title,
    robots: { index: false },
  };
}
export default async function TranslationPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ source?: string; target?: string }>;
}) {
  const { slug, id } = await params;
  const [context, query, locale] = await Promise.all([
    translationContext(slug, id),
    searchParams,
    getLocale(),
  ]);
  if (!context) notFound();
  const { page, session, role, fandom } = context;
  const defaultSource: Locale = fandom.language === "en" ? "en" : "ru";
  const parsed = translationPair.safeParse({
    source: query.source ?? defaultSource,
    target: query.target ?? (defaultSource === "ru" ? "en" : "ru"),
  });
  const pair = parsed.success
    ? parsed.data
    : {
        source: defaultSource,
        target: defaultSource === "ru" ? ("en" as const) : ("ru" as const),
      };
  const cached = parsed.success
    ? await readTranslation(page, pair.source, pair.target)
    : null;
  const machine = cached?.translation.content;
  const content = cached?.correction?.content ?? machine;
  const t = translationCopy[locale];
  const controls = {
    endpoint: `/api/fandoms/${slug}/pages/${id}/translation`,
    ...pair,
    revision: page.revision,
    locale,
  };
  return (
    <div className="community-page stack">
      <Link href={`/f/${slug}/wiki/${page.slug}`}>← {t.original}</Link>
      <div>
        <h1>{t.title}</h1>
        <p className="muted">
          {page.title} · {t.revision} {page.revision}
        </p>
      </div>
      <form method="get" className="translation-languages panel">
        <label>
          {t.source}
          <select name="source" defaultValue={pair.source}>
            <option value="ru">Русский</option>
            <option value="en">English</option>
          </select>
        </label>
        <span aria-hidden="true">→</span>
        <label>
          {t.target}
          <select name="target" defaultValue={pair.target}>
            <option value="en">English</option>
            <option value="ru">Русский</option>
          </select>
        </label>
        <button className="button" type="submit">
          {t.show}
        </button>
      </form>
      {!parsed.success && (
        <p className="error" role="alert">
          {t.errors.invalid}
        </p>
      )}
      {content ? (
        <>
          <div className="translation-notice">
            <strong>{cached?.correction ? t.corrected : t.machine}</strong>
            <p>{t.cached}</p>
          </div>
          <article className="panel translation-content" lang={pair.target}>
            <h2>{content.title}</h2>
            {content.summary && <p className="muted">{content.summary}</p>}
            <MarkdownRenderer
              markdown={content.markdown}
              fandomSlug={slug}
              idPrefix="translation-heading"
              tocLabel={locale === "en" ? "Contents" : "Содержание"}
              toc
            />
          </article>
          {canEditContent(role) && (
            <TranslationCorrection
              key={`${cached?.translation.id}:${cached?.correction?.version ?? 0}`}
              {...controls}
              content={content}
              version={cached?.correction?.version ?? 0}
            />
          )}
          {cached?.correction && machine && (
            <details className="panel">
              <summary>{t.machineVersion}</summary>
              <div lang={pair.target}>
                <h2>{machine.title}</h2>
                <p>{machine.summary}</p>
                <MarkdownRenderer
                  markdown={machine.markdown}
                  fandomSlug={slug}
                  idPrefix="machine-heading"
                />
              </div>
            </details>
          )}
        </>
      ) : (
        parsed.success && (
          <section className="panel stack">
            <h2>{t.empty}</h2>
            {!translationEnabled() ? (
              <p>{t.disabled}</p>
            ) : session ? (
              <TranslationRequest {...controls} />
            ) : (
              <Link href="/login">{t.login}</Link>
            )}
          </section>
        )
      )}
      <details className="panel">
        <summary>{t.sourceVersion}</summary>
        <div lang={pair.source}>
          <h2>{page.title}</h2>
          <p>{page.summary}</p>
          <MarkdownRenderer
            markdown={page.markdown}
            fandomSlug={slug}
            idPrefix="source-heading"
          />
        </div>
      </details>
    </div>
  );
}
