"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  pageDesigns,
  pageDesignVersions,
  pageRevisions,
  pages,
} from "@/lib/db/schema";
import { canEditContent, canManageFandom } from "@/lib/permissions";
import { type PlatformErrorCode, PlatformFailure } from "@/lib/platform-copy";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { mutationAccess } from "@/server/mutation-access";
import { requireUser } from "@/server/session";
export async function changePage(slug: string, id: string, form: FormData) {
  const current = await requireUser();
  const fandom = await getFandom(slug);
  const path = `/f/${slug}/pages/${id}/history`;
  const fail = (message: PlatformErrorCode): never =>
    redirect(`${path}?error=${encodeURIComponent(message)}`);
  if (!fandom) fail("fandomMissing");
  const role = await getMemberRole(fandom.id, current.id);
  const parsed = z
    .object({
      action: z.enum(["restore", "archive", "unarchive", "inherit"]),
      expected: z.coerce.number().int().positive(),
      version: z.coerce.number().int().nonnegative(),
    })
    .safeParse(Object.fromEntries(form));
  if (!parsed.success) return fail("invalid");
  if (!canEditContent(role)) return fail("access");
  const { action, expected, version } = parsed.data;
  if (
    (action === "archive" || action === "unarchive") &&
    !canManageFandom(role)
  )
    fail("archivePermission");
  let pageSlug = "";
  let blocked = false;
  try {
    await db.transaction(async (tx) => {
      const [page] = await tx
        .select()
        .from(pages)
        .where(and(eq(pages.id, id), eq(pages.fandomId, fandom.id)))
        .for("update");
      if (!page || page.revision !== expected)
        throw new PlatformFailure("changed");
      await mutationAccess(
        tx,
        fandom.id,
        current.id,
        action === "archive" || action === "unarchive" ? "manage" : "edit",
      );
      pageSlug = page.slug;
      blocked = !!page.blockedAt;
      if (page.deletedAt && action !== "unarchive")
        throw new PlatformFailure("unarchiveFirst");
      let content = {
        title: page.title,
        markdown: page.markdown,
        summary: page.summary,
        tags: page.tags,
        categories: page.categories,
        cover: page.cover,
      };
      if (action === "restore") {
        const [old] = await tx
          .select()
          .from(pageRevisions)
          .where(
            and(
              eq(pageRevisions.pageId, id),
              eq(pageRevisions.revision, version),
            ),
          )
          .limit(1);
        if (!old) throw new PlatformFailure("revisionMissing");
        content = {
          ...content,
          ...old.snapshot,
          title: old.title,
          markdown: old.markdown,
        };
      }
      if (action === "inherit") {
        const [design] = await tx
          .select()
          .from(pageDesigns)
          .where(eq(pageDesigns.pageId, id))
          .for("update");
        if (!design || design.revision !== version)
          throw new PlatformFailure("designChanged");
        await tx
          .update(pageDesigns)
          .set({
            published: null,
            publishedRevision: null,
            revision: version + 1,
            updatedAt: new Date(),
          })
          .where(eq(pageDesigns.pageId, id));
        await tx.insert(pageDesignVersions).values({
          id: crypto.randomUUID(),
          pageId: id,
          revision: version + 1,
          document: design.draft,
          published: false,
          editorId: current.id,
        });
      }
      await tx
        .update(pages)
        .set({
          ...content,
          deletedAt: action === "archive" ? new Date() : null,
          revision: expected + 1,
          updatedAt: new Date(),
        })
        .where(eq(pages.id, id));
      await tx.insert(pageRevisions).values({
        id: crypto.randomUUID(),
        pageId: id,
        revision: expected + 1,
        title: content.title,
        markdown: content.markdown,
        snapshot: {
          summary: content.summary,
          tags: content.tags,
          categories: content.categories,
          cover: content.cover,
        },
        editorId: current.id,
      });
    });
  } catch (e) {
    fail(e instanceof PlatformFailure ? e.code : "saveFailed");
  }
  revalidatePath(`/f/${slug}`);
  revalidatePath(`/f/${slug}/wiki/${pageSlug}`);
  redirect(
    action === "archive"
      ? `/f/${slug}/library?trash=1&archived=1`
      : blocked
        ? `/f/${slug}/pages/${id}/edit?saved=1`
        : `/f/${slug}/wiki/${pageSlug}`,
  );
}
