import { and, eq, isNull } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { updatePage } from "@/app/actions";
import { WikiEditor } from "@/components/wiki-editor";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { canEditContent } from "@/lib/permissions";
import { platformCopy, platformError } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return { title: platformCopy[await getLocale()].editArticle };
}
export default async function EditPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; id: string }>;
  searchParams: Promise<{ error?: string; saved?: string }>;
}) {
  const { slug, id } = await params;
  const { error, saved } = await searchParams;
  const current = await requireUser();
  const locale = await getLocale();
  const t = platformCopy[locale];
  const fandom = await getFandom(slug);
  if (!fandom) notFound();
  if (!canEditContent(await getMemberRole(fandom.id, current.id)))
    redirect(`/f/${slug}`);
  const [page] = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.id, id),
        eq(pages.fandomId, fandom.id),
        isNull(pages.deletedAt),
      ),
    )
    .limit(1);
  if (!page) notFound();
  return (
    <div className="narrow stack">
      <Link
        href={
          page.blockedAt ? `/f/${slug}/library` : `/f/${slug}/wiki/${page.slug}`
        }
      >
        ← {page.title}
      </Link>
      <h1>{t.editArticle}</h1>
      {saved === "1" && <p role="status">{t.saved}</p>}
      {page.blockedAt && (
        <p className="notice" role="status">
          {t.blockedHelp}
        </p>
      )}
      <form
        action={updatePage.bind(null, slug, page.id)}
        className="panel stack form-card"
      >
        <input type="hidden" name="revision" value={page.revision} />
        <label>
          {t.articleTitle}
          <input
            name="title"
            defaultValue={page.title}
            minLength={2}
            maxLength={160}
            required
          />
        </label>
        <label>
          {t.address}
          <input
            name="slug"
            defaultValue={page.slug}
            pattern="[a-zA-Z0-9][a-zA-Z0-9-]{1,46}[a-zA-Z0-9]"
            minLength={3}
            maxLength={48}
            required
          />
        </label>
        <label>
          {t.summary}
          <input name="summary" defaultValue={page.summary} maxLength={300} />
        </label>
        <label>
          {t.tags} <small>{t.tagsHelp}</small>
          <input
            name="tags"
            maxLength={500}
            defaultValue={page.tags.join(", ")}
            placeholder={t.tagsExample}
          />
        </label>
        <label>
          {t.categories} <small>{t.categoriesHelp}</small>
          <input
            name="categories"
            maxLength={500}
            defaultValue={page.categories.join(", ")}
          />
        </label>
        <label>
          {t.cover} <small>{t.coverHelp}</small>
          <input name="cover" maxLength={2000} defaultValue={page.cover} />
        </label>
        <WikiEditor locale={locale} fandomSlug={slug} initial={page.markdown} />
        <label>
          {t.status}
          <select name="status" defaultValue={page.status}>
            <option value="draft">{t.draft}</option>
            <option value="published">{t.published}</option>
          </select>
        </label>
        {error && (
          <p className="error" role="alert">
            {platformError(error, locale)}
          </p>
        )}
        <button className="button primary" type="submit">
          {t.saveChanges}
        </button>
      </form>
    </div>
  );
}
