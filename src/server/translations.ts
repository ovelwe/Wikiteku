import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  articleTranslations,
  pages,
  resourceQuotas,
  translationCorrections,
} from "@/lib/db/schema";
import type { Locale } from "@/lib/i18n";
import { canReadFandom } from "@/lib/permissions";
import {
  type TranslatedContent,
  TranslationFailure,
  translatedContent,
  translationLimits,
} from "@/lib/translation";
import {
  applyTranslationMarkdown,
  splitTranslationMarkdown,
  translationSkeleton,
} from "@/lib/translation-markdown";
import { getFandom, getMemberRole } from "./fandoms";
import { mutationAccess } from "./mutation-access";
import { getSession } from "./session";
import {
  translateFragments,
  translationEnabled,
  translationEngine,
  translationProvider,
} from "./translation-provider";

export async function translationContext(slug: string, id: string) {
  const [fandom, session] = await Promise.all([getFandom(slug), getSession()]);
  if (!fandom) return null;
  const role = await getMemberRole(fandom.id, session?.user.id);
  if (!canReadFandom(fandom.visibility, role)) return null;
  const [page] = await db
    .select()
    .from(pages)
    .where(and(eq(pages.id, id), eq(pages.fandomId, fandom.id)))
    .limit(1);
  if (page?.status !== "published" || page.blockedAt || page.deletedAt)
    return null;
  return { fandom, page, session, role };
}
type Page = typeof pages.$inferSelect;
export function translationIdentity(
  page: Page,
  source: Locale,
  target: Locale,
) {
  const sourceHash = createHash("sha256")
    .update(JSON.stringify([page.title, page.summary, page.markdown]))
    .digest("hex");
  const id = createHash("sha256")
    .update(
      JSON.stringify([
        page.id,
        page.revision,
        source,
        target,
        sourceHash,
        translationProvider,
        translationEngine,
      ]),
    )
    .digest("hex");
  return { id, sourceHash };
}
export async function readTranslation(
  page: Page,
  source: Locale,
  target: Locale,
) {
  const { id } = translationIdentity(page, source, target);
  const [row] = await db
    .select({
      translation: articleTranslations,
      correction: translationCorrections,
    })
    .from(articleTranslations)
    .leftJoin(
      translationCorrections,
      eq(translationCorrections.translationId, articleTranslations.id),
    )
    .where(
      and(
        eq(articleTranslations.id, id),
        eq(articleTranslations.status, "ready"),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function generateTranslation(
  page: Page,
  userId: string,
  source: Locale,
  target: Locale,
) {
  if (!translationEnabled()) throw new TranslationFailure("disabled");
  const identity = translationIdentity(page, source, target);
  const parts = splitTranslationMarkdown(page.markdown)
    .filter((part) => part.translate)
    .map((part) => part.text);
  const fragments = [page.title, page.summary, ...parts];
  const chars = fragments.reduce((sum, text) => sum + text.length, 0);
  if (
    page.markdown.length + page.title.length + page.summary.length >
      translationLimits.articleChars ||
    fragments.length > translationLimits.fragments ||
    fragments.some((text) => text.length > translationLimits.fragmentChars)
  )
    throw new TranslationFailure("limit");
  const attemptId = randomUUID();
  const cached = await db.transaction(async (tx) => {
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`translation:${identity.id}`}))`,
    );
    const [existing] = await tx
      .select()
      .from(articleTranslations)
      .where(eq(articleTranslations.id, identity.id))
      .limit(1);
    if (existing?.status === "ready") return true;
    if (existing && existing.retryAt.getTime() > Date.now())
      throw new TranslationFailure("busy");
    const day = new Date().toISOString().slice(0, 10);
    await tx.execute(
      sql`select pg_advisory_xact_lock(hashtext(${`translation-quota:${day}`}))`,
    );
    for (const [key, increment, maximum] of [
      [
        `translation:requests:${day}:${userId}`,
        1,
        translationLimits.userRequests,
      ],
      [
        `translation:characters:${day}:${userId}`,
        chars,
        translationLimits.userChars,
      ],
      [`translation:global:${day}`, chars, translationLimits.globalChars],
    ] as const) {
      const [usage] = await tx
        .select()
        .from(resourceQuotas)
        .where(eq(resourceQuotas.key, key))
        .limit(1);
      if ((usage?.count ?? 0) + increment > maximum)
        throw new TranslationFailure("limit");
      await tx
        .insert(resourceQuotas)
        .values({ key, count: increment })
        .onConflictDoUpdate({
          target: resourceQuotas.key,
          set: { count: sql`${resourceQuotas.count} + ${increment}` },
        });
    }
    await tx
      .insert(articleTranslations)
      .values({
        ...identity,
        pageId: page.id,
        sourceRevision: page.revision,
        sourceLanguage: source,
        targetLanguage: target,
        provider: translationProvider,
        engineVersion: translationEngine,
        attemptId,
        status: "pending",
        retryAt: new Date(Date.now() + 60000),
      })
      .onConflictDoUpdate({
        target: articleTranslations.id,
        set: {
          attemptId,
          status: "pending",
          retryAt: new Date(Date.now() + 60000),
        },
      });
    return false;
  });
  if (cached) return;
  const ownAttempt = and(
    eq(articleTranslations.id, identity.id),
    eq(articleTranslations.attemptId, attemptId),
  );
  try {
    const values = await translateFragments(fragments, source, target);
    let markdown: string;
    try {
      markdown = applyTranslationMarkdown(page.markdown, values.slice(2));
    } catch {
      throw new TranslationFailure("structure");
    }
    const content = translatedContent.parse({
      title: values[0],
      summary: values[1],
      markdown,
    });
    const result = await db
      .update(articleTranslations)
      .set({ content, status: "ready" })
      .where(ownAttempt)
      .returning({ id: articleTranslations.id });
    if (!result.length) throw new TranslationFailure("busy");
  } catch (error) {
    await db
      .update(articleTranslations)
      .set({ status: "failed", retryAt: new Date(Date.now() + 60000) })
      .where(ownAttempt);
    throw error instanceof TranslationFailure
      ? error
      : new TranslationFailure("unavailable");
  }
}

export async function saveTranslationCorrection(
  page: Page,
  userId: string,
  source: Locale,
  target: Locale,
  version: number,
  content: TranslatedContent,
) {
  if (
    translationSkeleton(page.markdown) !== translationSkeleton(content.markdown)
  )
    throw new TranslationFailure("structure");
  const { id } = translationIdentity(page, source, target);
  await db.transaction(async (tx) => {
    const [currentPage] = await tx
      .select()
      .from(pages)
      .where(eq(pages.id, page.id))
      .for("update");
    if (
      !currentPage ||
      currentPage.revision !== page.revision ||
      currentPage.deletedAt ||
      currentPage.blockedAt ||
      currentPage.status !== "published"
    )
      throw new TranslationFailure("changed");
    await mutationAccess(tx, currentPage.fandomId, userId, "edit");
    const [machine] = await tx
      .select()
      .from(articleTranslations)
      .where(
        and(
          eq(articleTranslations.id, id),
          eq(articleTranslations.status, "ready"),
        ),
      )
      .limit(1);
    if (!machine?.content) throw new TranslationFailure("changed");
    const [previous] = await tx
      .select()
      .from(translationCorrections)
      .where(eq(translationCorrections.translationId, id))
      .limit(1);
    if ((previous?.version ?? 0) !== version)
      throw new TranslationFailure("changed");
    await tx
      .insert(translationCorrections)
      .values({
        translationId: id,
        content,
        editorId: userId,
        version: version + 1,
      })
      .onConflictDoUpdate({
        target: translationCorrections.translationId,
        set: {
          content,
          editorId: userId,
          version: version + 1,
          updatedAt: new Date(),
        },
      });
  });
}
