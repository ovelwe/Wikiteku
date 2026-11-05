import "server-only";
import { and, desc, eq, isNull } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { pages } from "@/lib/db/schema";

export const getPage = cache(async function getPage(
  fandomId: string,
  slug: string,
) {
  const [page] = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.fandomId, fandomId),
        isNull(pages.deletedAt),
        isNull(pages.blockedAt),
        eq(pages.slug, slug),
      ),
    )
    .limit(1);
  return page ?? null;
});

export async function listPages(fandomId: string, includeDrafts = false) {
  return db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.fandomId, fandomId),
        isNull(pages.deletedAt),
        isNull(pages.blockedAt),
        includeDrafts ? undefined : eq(pages.status, "published"),
      ),
    )
    .orderBy(desc(pages.updatedAt))
    .limit(100);
}
