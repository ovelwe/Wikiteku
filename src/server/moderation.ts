import "server-only";
import { randomUUID } from "node:crypto";
import { and, eq, sql } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/lib/db";
import {
  fandomMembers,
  fandoms,
  moderationEvents,
  pages,
  reports,
  resourceQuotas,
} from "@/lib/db/schema";
import {
  type decisionInput,
  ModerationFailure,
  type reportInput,
} from "@/lib/moderation";
import { canReadFandom } from "@/lib/permissions";

export function isPlatformModerator(userId?: string) {
  return (
    !!userId &&
    (process.env.PLATFORM_MODERATOR_IDS ?? "")
      .split(",")
      .map((id) => id.trim())
      .filter(Boolean)
      .includes(userId)
  );
}

export async function submitReport(
  userId: string,
  input: z.infer<typeof reportInput>,
) {
  return db.transaction(async (tx) => {
    const [page] = await tx
      .select()
      .from(pages)
      .where(eq(pages.id, input.pageId))
      .for("update");
    if (
      !page ||
      page.deletedAt ||
      page.blockedAt ||
      page.status !== "published"
    )
      throw new ModerationFailure(404, "access");
    const [fandom] = await tx
      .select()
      .from(fandoms)
      .where(eq(fandoms.id, page.fandomId))
      .for("share");
    const [member] = await tx
      .select()
      .from(fandomMembers)
      .where(
        and(
          eq(fandomMembers.fandomId, page.fandomId),
          eq(fandomMembers.userId, userId),
        ),
      )
      .for("share");
    if (!fandom || !canReadFandom(fandom.visibility, member?.role ?? null))
      throw new ModerationFailure(404, "access");
    if (page.revision !== input.revision)
      throw new ModerationFailure(409, "changed");
    const [existing] = await tx
      .select({ id: reports.id })
      .from(reports)
      .where(
        and(
          eq(reports.pageId, page.id),
          eq(reports.reporterId, userId),
          eq(reports.status, "open"),
        ),
      );
    if (existing) return existing.id;
    const key = `reports:${userId}:${new Date().toISOString().slice(0, 10)}`;
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${key}))`);
    const [quota] = await tx
      .select()
      .from(resourceQuotas)
      .where(eq(resourceQuotas.key, key));
    if ((quota?.count ?? 0) >= 10) throw new ModerationFailure(429, "limit");
    await tx
      .insert(resourceQuotas)
      .values({ key, count: 1 })
      .onConflictDoUpdate({
        target: resourceQuotas.key,
        set: { count: sql`${resourceQuotas.count} + 1` },
      });
    const id = randomUUID();
    await tx.insert(reports).values({
      id,
      pageId: page.id,
      reporterId: userId,
      reason: input.reason,
      details: input.details,
      snapshot: {
        title: page.title,
        summary: page.summary,
        markdown: page.markdown,
        revision: page.revision,
      },
    });
    return id;
  });
}

export async function decideReport(
  actorId: string,
  input: z.infer<typeof decisionInput>,
) {
  if (!isPlatformModerator(actorId)) throw new ModerationFailure(403, "access");
  return db.transaction(async (tx) => {
    const [target] = await tx
      .select({ pageId: reports.pageId })
      .from(reports)
      .where(eq(reports.id, input.reportId));
    if (!target) throw new ModerationFailure(404, "access");
    // Consistent lock order with submission: article, then report.
    const [page] = await tx
      .select()
      .from(pages)
      .where(eq(pages.id, target.pageId))
      .for("update");
    const [report] = await tx
      .select()
      .from(reports)
      .where(eq(reports.id, input.reportId))
      .for("update");
    if (
      !page ||
      !report ||
      page.moderationRevision !== input.revision ||
      page.revision !== input.pageRevision
    )
      throw new ModerationFailure(409, "changed");
    if (
      input.action === "unblock"
        ? report.decision !== "block" || !page.blockedAt
        : report.status !== "open"
    )
      throw new ModerationFailure(409, "changed");
    const revision = page.moderationRevision + 1;
    await tx
      .update(pages)
      .set({
        moderationRevision: revision,
        ...(input.action === "dismiss"
          ? {}
          : { blockedAt: input.action === "block" ? new Date() : null }),
      })
      .where(eq(pages.id, page.id));
    if (input.action !== "unblock")
      await tx
        .update(reports)
        .set({
          status: "resolved",
          decision: input.action,
          resolvedAt: new Date(),
        })
        .where(eq(reports.id, report.id));
    await tx.insert(moderationEvents).values({
      id: randomUUID(),
      reportId: report.id,
      pageId: page.id,
      actorId,
      action: input.action,
      note: input.note,
      moderationRevision: revision,
    });
  });
}
