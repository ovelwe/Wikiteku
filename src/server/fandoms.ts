import "server-only";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";
import { cache } from "react";
import { db } from "@/lib/db";
import { fandomMembers, fandoms, pages } from "@/lib/db/schema";
import type { Role } from "@/lib/permissions";

export const getMemberRole = cache(async function getMemberRole(
  fandomId: string,
  userId?: string,
): Promise<Role> {
  if (!userId) return null;
  const [member] = await db
    .select({ role: fandomMembers.role })
    .from(fandomMembers)
    .where(
      and(
        eq(fandomMembers.fandomId, fandomId),
        eq(fandomMembers.userId, userId),
      ),
    )
    .limit(1);
  return member?.role ?? null;
});

export const getFandom = cache(async function getFandom(slug: string) {
  const [fandom] = await db
    .select()
    .from(fandoms)
    .where(eq(fandoms.slug, slug))
    .limit(1);
  return fandom ?? null;
});

export async function listFandoms({
  page = 1,
  query = "",
  category = "",
  sort = "active",
}: {
  page?: number;
  query?: string;
  category?: string;
  sort?: "active" | "new" | "popular";
} = {}) {
  const articleCount = count(pages.id);
  const where = and(
    eq(fandoms.visibility, "public"),
    query
      ? or(
          ilike(fandoms.title, `%${query}%`),
          ilike(fandoms.description, `%${query}%`),
          sql`array_to_string(${fandoms.tags}, ' ') ilike ${`%${query}%`}`,
        )
      : undefined,
    category ? eq(fandoms.category, category) : undefined,
  );
  const [items, totals] = await Promise.all([
    db
      .select({
        id: fandoms.id,
        slug: fandoms.slug,
        title: fandoms.title,
        description: fandoms.description,
        category: fandoms.category,
        tags: fandoms.tags,
        updatedAt: fandoms.updatedAt,
        articleCount,
      })
      .from(fandoms)
      .leftJoin(
        pages,
        and(
          eq(pages.fandomId, fandoms.id),
          and(
            eq(pages.status, "published"),
            isNull(pages.deletedAt),
            isNull(pages.blockedAt),
          ),
        ),
      )
      .where(where)
      .groupBy(fandoms.id)
      .orderBy(
        sort === "new"
          ? desc(fandoms.createdAt)
          : sort === "popular"
            ? desc(articleCount)
            : desc(fandoms.updatedAt),
      )
      .limit(12)
      .offset((page - 1) * 12),
    db.select({ value: count() }).from(fandoms).where(where),
  ]);
  return { items, total: totals[0]?.value ?? 0 };
}

export async function latestArticles(page = 1) {
  return db
    .select({
      id: pages.id,
      slug: pages.slug,
      title: pages.title,
      summary: pages.summary,
      updatedAt: pages.updatedAt,
      fandomSlug: fandoms.slug,
      fandomTitle: fandoms.title,
    })
    .from(pages)
    .innerJoin(fandoms, eq(pages.fandomId, fandoms.id))
    .where(
      and(
        and(
          eq(pages.status, "published"),
          isNull(pages.deletedAt),
          isNull(pages.blockedAt),
        ),
        eq(fandoms.visibility, "public"),
      ),
    )
    .orderBy(desc(pages.updatedAt))
    .limit(10)
    .offset((page - 1) * 10);
}
