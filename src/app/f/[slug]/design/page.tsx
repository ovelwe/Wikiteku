import { notFound, redirect } from "next/navigation";
import { DesignEditor } from "@/components/builder/editor";
import { makeTemplate } from "@/lib/builder";
import { canManageFandom } from "@/lib/permissions";
import { getDesign, getDesignHistory } from "@/server/designs";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { listPages } from "@/server/pages";
import { requireUser } from "@/server/session";
export const metadata = {
  title: "Студия оформления",
  robots: { index: false },
};
export default async function DesignPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const current = await requireUser();
  const { slug } = await params;
  const fandom = await getFandom(slug);
  if (!fandom) notFound();
  if (!canManageFandom(await getMemberRole(fandom.id, current.id)))
    redirect(`/f/${slug}`);
  const [design, history, articles] = await Promise.all([
    getDesign(fandom.id),
    getDesignHistory(fandom.id),
    listPages(fandom.id),
  ]);
  return (
    <DesignEditor
      slug={slug}
      title={fandom.title}
      description={fandom.description}
      initial={
        design?.draft ??
        makeTemplate("aurora", fandom.title, fandom.description)
      }
      revision={design?.revision ?? 0}
      history={history}
      articles={articles.map((p) => ({
        title: p.title,
        summary: p.summary,
        href: `/f/${slug}/wiki/${p.slug}`,
      }))}
    />
  );
}
