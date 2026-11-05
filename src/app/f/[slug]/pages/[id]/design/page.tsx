import { and, eq, isNull } from "drizzle-orm";
import { notFound } from "next/navigation";
import { DesignEditor } from "@/components/builder/editor";
import { type DesignDocument, defaultTheme } from "@/lib/builder";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";
import { canEditContent } from "@/lib/permissions";
import {
  getDesign,
  getPageDesign,
  getPageDesignHistory,
} from "@/server/designs";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { requireUser } from "@/server/session";
export const metadata = {
  title: "Оформление статьи",
  robots: { index: false },
};
export default async function Page({
  params,
}: {
  params: Promise<{ slug: string; id: string }>;
}) {
  const { slug, id } = await params;
  const current = await requireUser();
  const fandom = await getFandom(slug);
  if (!fandom || !canEditContent(await getMemberRole(fandom.id, current.id)))
    notFound();
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
  const [design, history, parent] = await Promise.all([
    getPageDesign(id),
    getPageDesignHistory(id),
    getDesign(fandom.id),
  ]);
  const initial: DesignDocument = {
    schemaVersion: 1,
    data: {
      root: { props: parent?.published?.data.root.props ?? defaultTheme },
      content: [{ type: "ArticleBody", props: { id: "article-body" } }],
    },
  };
  return (
    <DesignEditor
      slug={slug}
      title={page.title}
      description={page.summary}
      initial={design?.draft ?? initial}
      revision={design?.revision ?? 0}
      history={history}
      articles={[]}
      article={{
        id,
        slug: page.slug,
        markdown: page.markdown,
        fandomSlug: slug,
        header: {
          title: page.title,
          cover: page.cover,
          summary: page.summary,
          categories: page.categories,
          tags: page.tags,
        },
      }}
    />
  );
}
