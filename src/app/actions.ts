"use server";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import {
  fandomMembers,
  fandoms,
  pageRevisions,
  pages,
  profiles,
  resourceQuotas,
  user,
} from "@/lib/db/schema";
import { canEditContent, canManageFandom } from "@/lib/permissions";
import type { PlatformErrorCode } from "@/lib/platform-copy";
import {
  createFandomSchema,
  pageSchema,
  profileSchema,
  usernameSchema,
} from "@/lib/validation";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { mutationAccess } from "@/server/mutation-access";
import { requireUser } from "@/server/session";

function field(form: FormData, name: string) {
  return String(form.get(name) ?? "");
}
function fail(path: string, message: PlatformErrorCode): never {
  redirect(`${path}?error=${encodeURIComponent(message)}`);
}

class DailyQuotaExceeded extends Error {}

async function consumeDailyQuota(
  tx: Parameters<Parameters<typeof db.transaction>[0]>[0],
  kind: string,
  userId: string,
  limit: number,
) {
  const key = `${kind}:${userId}:${new Date().toISOString().slice(0, 10)}`;
  const [row] = await tx
    .insert(resourceQuotas)
    .values({ key, count: 1 })
    .onConflictDoUpdate({
      target: resourceQuotas.key,
      set: { count: sql`${resourceQuotas.count} + 1` },
      setWhere: sql`${resourceQuotas.count} < ${limit}`,
    })
    .returning({ count: resourceQuotas.count });
  if (!row) throw new DailyQuotaExceeded();
}

export async function createFandom(form: FormData) {
  const current = await requireUser();
  const parsed = createFandomSchema.safeParse({
    title: field(form, "title"),
    slug: field(form, "slug"),
    description: field(form, "description"),
    category: field(form, "category"),
    tags: field(form, "tags"),
    language: field(form, "language"),
    visibility: field(form, "visibility"),
  });
  if (!parsed.success) fail("/create", "invalid");
  if (await getFandom(parsed.data.slug)) fail("/create", "addressTaken");
  const id = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await consumeDailyQuota(tx, "fandom", current.id, 3);
      await tx
        .insert(fandoms)
        .values({ ...parsed.data, id, ownerId: current.id });
      await tx.insert(fandomMembers).values({
        id: crypto.randomUUID(),
        fandomId: id,
        userId: current.id,
        role: "owner",
      });
    });
  } catch (error) {
    if (error instanceof DailyQuotaExceeded) fail("/create", "fandomLimit");
    fail("/create", "fandomSave");
  }
  revalidatePath("/explore");
  redirect(`/f/${parsed.data.slug}`);
}

export async function createPage(fandomSlug: string, form: FormData) {
  const current = await requireUser();
  const fandom = await getFandom(fandomSlug);
  if (!fandom) fail("/explore", "fandomMissing");
  if (!canEditContent(await getMemberRole(fandom.id, current.id)))
    fail(`/f/${fandomSlug}`, "noCreate");
  const parsed = pageSchema.safeParse({
    title: field(form, "title"),
    slug: field(form, "slug"),
    markdown: field(form, "markdown"),
    summary: field(form, "summary"),
    tags: field(form, "tags"),
    categories: field(form, "categories"),
    cover: field(form, "cover"),
    status: field(form, "status"),
  });
  if (!parsed.success) fail(`/f/${fandomSlug}/pages/new`, "invalid");
  const id = crypto.randomUUID();
  try {
    await db.transaction(async (tx) => {
      await mutationAccess(tx, fandom.id, current.id, "edit");
      await consumeDailyQuota(tx, "page", current.id, 50);
      await tx.insert(pages).values({
        ...parsed.data,
        id,
        fandomId: fandom.id,
        authorId: current.id,
      });
      await tx.insert(pageRevisions).values({
        id: crypto.randomUUID(),
        pageId: id,
        revision: 1,
        title: parsed.data.title,
        markdown: parsed.data.markdown,
        snapshot: {
          summary: parsed.data.summary,
          tags: parsed.data.tags,
          categories: parsed.data.categories,
          cover: parsed.data.cover,
        },
        editorId: current.id,
      });
    });
  } catch (error) {
    if (error instanceof DailyQuotaExceeded)
      fail(`/f/${fandomSlug}/pages/new`, "pageLimit");
    fail(`/f/${fandomSlug}/pages/new`, "pageSave");
  }
  revalidatePath(`/f/${fandomSlug}`);
  redirect(`/f/${fandomSlug}/wiki/${parsed.data.slug}`);
}

export async function updatePage(
  fandomSlug: string,
  pageId: string,
  form: FormData,
) {
  const current = await requireUser();
  const fandom = await getFandom(fandomSlug);
  if (!fandom) fail("/explore", "fandomMissing");
  if (!canEditContent(await getMemberRole(fandom.id, current.id)))
    fail(`/f/${fandomSlug}`, "noEdit");
  const parsed = pageSchema.safeParse({
    title: field(form, "title"),
    slug: field(form, "slug"),
    markdown: field(form, "markdown"),
    summary: field(form, "summary"),
    tags: field(form, "tags"),
    categories: field(form, "categories"),
    cover: field(form, "cover"),
    status: field(form, "status"),
  });
  if (!parsed.success) fail(`/f/${fandomSlug}/pages/${pageId}/edit`, "invalid");
  const revision = Number(field(form, "revision"));
  if (!Number.isSafeInteger(revision) || revision < 1)
    fail(`/f/${fandomSlug}`, "revisionInvalid");
  let updated: boolean;
  let blocked = false;
  try {
    updated = await db.transaction(async (tx) => {
      await tx
        .select({ id: pages.id })
        .from(pages)
        .where(and(eq(pages.id, pageId), eq(pages.fandomId, fandom.id)))
        .for("update");
      await mutationAccess(tx, fandom.id, current.id, "edit");
      const [row] = await tx
        .update(pages)
        .set({ ...parsed.data, revision: revision + 1, updatedAt: new Date() })
        .where(
          and(
            eq(pages.id, pageId),
            eq(pages.fandomId, fandom.id),
            eq(pages.revision, revision),
            isNull(pages.deletedAt),
          ),
        )
        .returning({ id: pages.id, blockedAt: pages.blockedAt });
      if (!row) return false;
      blocked = !!row.blockedAt;
      await tx.insert(pageRevisions).values({
        id: crypto.randomUUID(),
        pageId,
        revision: revision + 1,
        title: parsed.data.title,
        markdown: parsed.data.markdown,
        snapshot: {
          summary: parsed.data.summary,
          tags: parsed.data.tags,
          categories: parsed.data.categories,
          cover: parsed.data.cover,
        },
        editorId: current.id,
      });
      return true;
    });
  } catch {
    fail(`/f/${fandomSlug}/pages/${pageId}/edit`, "pageSave");
  }
  if (!updated) fail(`/f/${fandomSlug}/pages/${pageId}/edit`, "changed");
  revalidatePath(`/f/${fandomSlug}`);
  if (blocked) redirect(`/f/${fandomSlug}/pages/${pageId}/edit?saved=1`);
  redirect(`/f/${fandomSlug}/wiki/${parsed.data.slug}`);
}

export async function updateFandom(fandomSlug: string, form: FormData) {
  const current = await requireUser();
  const fandom = await getFandom(fandomSlug);
  if (!fandom) fail("/explore", "fandomMissing");
  if (!canManageFandom(await getMemberRole(fandom.id, current.id)))
    fail(`/f/${fandomSlug}`, "noManage");
  const parsed = createFandomSchema.omit({ slug: true }).safeParse({
    title: field(form, "title"),
    description: field(form, "description"),
    category: field(form, "category"),
    tags: field(form, "tags"),
    language: field(form, "language"),
    visibility: field(form, "visibility"),
  });
  if (!parsed.success) fail(`/f/${fandomSlug}/settings`, "invalid");
  try {
    await db.transaction(async (tx) => {
      await mutationAccess(tx, fandom.id, current.id, "manage", "update");
      await tx
        .update(fandoms)
        .set({ ...parsed.data, updatedAt: new Date() })
        .where(eq(fandoms.id, fandom.id));
    });
  } catch {
    fail(`/f/${fandomSlug}/settings`, "saveFailed");
  }
  revalidatePath(`/f/${fandomSlug}`);
  redirect(`/f/${fandomSlug}`);
}

export async function addMember(fandomSlug: string, form: FormData) {
  const current = await requireUser();
  const fandom = await getFandom(fandomSlug);
  if (!fandom) fail("/explore", "fandomMissing");
  const actorRole = await getMemberRole(fandom.id, current.id);
  if (!canManageFandom(actorRole)) fail(`/f/${fandomSlug}`, "noManage");
  const username = usernameSchema.safeParse(field(form, "username"));
  const requested = field(form, "role");
  if (!username.success || !["admin", "editor", "reader"].includes(requested))
    fail(`/f/${fandomSlug}/settings`, "memberInvalid");
  if (actorRole !== "owner" && requested === "admin")
    fail(`/f/${fandomSlug}/settings`, "adminOwnerOnly");
  const [target] = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.username, username.data))
    .limit(1);
  if (!target) fail(`/f/${fandomSlug}/settings`, "userMissing");
  if (target.id === fandom.ownerId)
    fail(`/f/${fandomSlug}/settings`, "ownerImmutable");
  const role = requested as "admin" | "editor" | "reader";
  const changed = await db
    .transaction(async (tx) => {
      const { role: currentRole } = await mutationAccess(
        tx,
        fandom.id,
        current.id,
        "manage",
        "update",
      );
      if (currentRole !== "owner" && requested === "admin") return false;
      const [row] = await tx
        .insert(fandomMembers)
        .values({
          id: crypto.randomUUID(),
          fandomId: fandom.id,
          userId: target.id,
          role,
        })
        .onConflictDoUpdate({
          target: [fandomMembers.fandomId, fandomMembers.userId],
          set: { role },
          setWhere:
            currentRole === "owner"
              ? sql`${fandomMembers.role} <> 'owner'`
              : sql`${fandomMembers.role} not in ('owner', 'admin')`,
        })
        .returning({ id: fandomMembers.id });
      return row;
    })
    .catch(() => null);
  if (!changed) fail(`/f/${fandomSlug}/settings`, "roleOwnerOnly");
  revalidatePath(`/f/${fandomSlug}/settings`);
  redirect(`/f/${fandomSlug}/settings`);
}

export async function updateProfile(form: FormData) {
  const current = await requireUser();
  const parsed = profileSchema.safeParse({
    name: field(form, "name"),
    bio: field(form, "bio"),
  });
  if (!parsed.success) fail("/settings", "invalid");
  await db.transaction(async (tx) => {
    await tx
      .update(user)
      .set({ name: parsed.data.name, updatedAt: new Date() })
      .where(eq(user.id, current.id));
    await tx
      .insert(profiles)
      .values({ userId: current.id, bio: parsed.data.bio })
      .onConflictDoUpdate({
        target: profiles.userId,
        set: { bio: parsed.data.bio },
      });
  });
  revalidatePath(`/u/${current.username}`);
  redirect(`/u/${current.username}`);
}
