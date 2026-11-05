/* biome-ignore-all lint/performance/noImgElement: Authenticated media is served by the application. */
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { canEditContent } from "@/lib/permissions";
import { platformCopy } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { requireUser } from "@/server/session";
export async function generateMetadata() {
  return {
    title: platformCopy[await getLocale()].media,
    robots: { index: false },
  };
}
export default async function MediaPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const current = await requireUser();
  const locale = await getLocale();
  const t = platformCopy[locale];
  const fandom = await getFandom(slug);
  if (!fandom || !canEditContent(await getMemberRole(fandom.id, current.id)))
    notFound();
  const files = await db
    .select({
      id: media.id,
      name: media.name,
      alt: media.alt,
      bytes: media.bytes,
    })
    .from(media)
    .where(eq(media.fandomId, fandom.id))
    .orderBy(desc(media.createdAt))
    .limit(100);
  return (
    <div className="stack">
      <Link href={`/f/${slug}`}>← {fandom.title}</Link>
      <h1>{t.media}</h1>
      <p>{t.mediaHelp}</p>
      <div className="fandom-grid">
        {files.map((file) => (
          <article className="panel" key={file.id}>
            <img
              className="wiki-cover"
              src={`/api/media/${file.id}`}
              alt={file.alt}
            />
            <h2>{file.name}</h2>
            <label>
              {t.imageAddress}
              <input readOnly value={`/api/media/${file.id}`} />
            </label>
            <small>
              {Math.ceil(file.bytes / 1024)} {t.kb}
            </small>
          </article>
        ))}
      </div>
      {!files.length && <p>{t.noImages}</p>}
    </div>
  );
}
