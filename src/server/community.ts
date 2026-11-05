import "server-only";
import { and, desc, eq, isNotNull, isNull, ne, or } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";
import { db } from "@/lib/db";
import { fandomMembers, fandoms, favorites, pages } from "@/lib/db/schema";
import { canReadFandom } from "@/lib/permissions";

export const getLocale = cache(async () =>
  (await cookies()).get("locale")?.value === "en"
    ? ("en" as const)
    : ("ru" as const),
);

export async function isFavorite(userId: string, fandomId: string) {
  const [row] = await db
    .select({ id: favorites.id })
    .from(favorites)
    .where(and(eq(favorites.userId, userId), eq(favorites.fandomId, fandomId)))
    .limit(1);
  return !!row;
}

export async function listFavorites(userId: string) {
  const rows = await db
    .select({ fandom: fandoms, role: fandomMembers.role })
    .from(favorites)
    .innerJoin(fandoms, eq(favorites.fandomId, fandoms.id))
    .leftJoin(
      fandomMembers,
      and(
        eq(fandomMembers.fandomId, fandoms.id),
        eq(fandomMembers.userId, userId),
      ),
    )
    .where(eq(favorites.userId, userId))
    .orderBy(desc(favorites.createdAt))
    .limit(100);
  // Never expose titles or descriptions after access has been revoked.
  return rows.map(({ fandom, role }) => ({
    id: fandom.id,
    fandom: canReadFandom(fandom.visibility, role) ? fandom : null,
  }));
}

export async function listActivity(userId: string, page: number) {
  return db
    .select({
      id: pages.id,
      title: pages.title,
      slug: pages.slug,
      summary: pages.summary,
      revision: pages.revision,
      updatedAt: pages.updatedAt,
      fandomSlug: fandoms.slug,
      fandomTitle: fandoms.title,
    })
    .from(pages)
    .innerJoin(fandoms, eq(pages.fandomId, fandoms.id))
    .innerJoin(
      favorites,
      and(eq(favorites.fandomId, fandoms.id), eq(favorites.userId, userId)),
    )
    .leftJoin(
      fandomMembers,
      and(
        eq(fandomMembers.fandomId, fandoms.id),
        eq(fandomMembers.userId, userId),
      ),
    )
    .where(
      and(
        eq(pages.status, "published"),
        isNull(pages.deletedAt),
        isNull(pages.blockedAt),
        or(ne(fandoms.visibility, "private"), isNotNull(fandomMembers.userId)),
      ),
    )
    .orderBy(desc(pages.updatedAt), desc(pages.id))
    .limit(21)
    .offset((page - 1) * 20);
}
