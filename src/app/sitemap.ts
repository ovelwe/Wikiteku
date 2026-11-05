import { and, eq, isNull } from "drizzle-orm";
import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { fandoms, pages } from "@/lib/db/schema";
export const dynamic = "force-dynamic";
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = process.env.BETTER_AUTH_URL ?? "http://localhost:3000";
  const [rows, articles] = await Promise.all([
    db
      .select({ slug: fandoms.slug, updatedAt: fandoms.updatedAt })
      .from(fandoms)
      .where(eq(fandoms.visibility, "public"))
      .limit(10000),
    db
      .select({
        slug: pages.slug,
        fandomSlug: fandoms.slug,
        updatedAt: pages.updatedAt,
      })
      .from(pages)
      .innerJoin(fandoms, eq(pages.fandomId, fandoms.id))
      .where(
        and(
          eq(fandoms.visibility, "public"),
          and(
            eq(pages.status, "published"),
            isNull(pages.deletedAt),
            isNull(pages.blockedAt),
          ),
        ),
      )
      .limit(40000),
  ]);
  return [
    { url: base },
    { url: `${base}/explore` },
    ...rows.map((row) => ({
      url: `${base}/f/${row.slug}`,
      lastModified: row.updatedAt,
    })),
    ...articles.map((article) => ({
      url: `${base}/f/${article.fandomSlug}/wiki/${article.slug}`,
      lastModified: article.updatedAt,
    })),
  ];
}
