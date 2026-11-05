import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createPage } from "@/app/actions";
import { WikiEditor } from "@/components/wiki-editor";
import { canEditContent } from "@/lib/permissions";
import { platformCopy, platformError } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return { title: platformCopy[await getLocale()].newArticle };
}
export default async function NewPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const current = await requireUser();
  const locale = await getLocale();
  const t = platformCopy[locale];
  const fandom = await getFandom(slug);
  if (!fandom) notFound();
  if (!canEditContent(await getMemberRole(fandom.id, current.id)))
    redirect(`/f/${slug}`);
  return (
    <div className="narrow stack">
      <Link href={`/f/${slug}`}>← {fandom.title}</Link>
      <h1>{t.newArticle}</h1>
      <form
        action={createPage.bind(null, slug)}
        className="panel stack form-card"
      >
        <label>
          {t.articleTitle}
          <input name="title" minLength={2} maxLength={160} required />
        </label>
        <label>
          {t.address}
          <input
            name="slug"
            pattern="[a-zA-Z0-9][a-zA-Z0-9-]{1,46}[a-zA-Z0-9]"
            minLength={3}
            maxLength={48}
            required
          />
        </label>
        <label>
          {t.summary}
          <input name="summary" maxLength={300} />
        </label>
        <label>
          {t.tags} <small>{t.tagsHelp}</small>
          <input name="tags" maxLength={500} placeholder={t.tagsExample} />
        </label>
        <label>
          {t.categories} <small>{t.categoriesHelp}</small>
          <input name="categories" maxLength={500} />
        </label>
        <label>
          {t.cover} <small>{t.coverHelp}</small>
          <input name="cover" maxLength={2000} />
        </label>
        <WikiEditor locale={locale} fandomSlug={slug} initial={""} />
        <label>
          {t.status}
          <select name="status" defaultValue="draft">
            <option value="draft">{t.draft}</option>
            <option value="published">{t.publish}</option>
          </select>
        </label>
        {error && (
          <p className="error" role="alert">
            {platformError(error, locale)}
          </p>
        )}
        <button className="button primary" type="submit">
          {t.saveArticle}
        </button>
      </form>
    </div>
  );
}
