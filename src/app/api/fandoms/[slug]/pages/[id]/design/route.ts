import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { describeDesignErrors, saveDesignSchema } from "@/lib/builder";
import { db } from "@/lib/db";
import { pageDesigns, pageDesignVersions, pages } from "@/lib/db/schema";
import { canEditContent } from "@/lib/permissions";
import { PlatformFailure } from "@/lib/platform-copy";
import { getPageDesignHistory } from "@/server/designs";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { mutationAccess } from "@/server/mutation-access";
import { BodyTooLarge, boundedBody, sameOrigin } from "@/server/request";
import { getSession } from "@/server/session";

type Context = { params: Promise<{ slug: string; id: string }> };
async function access(slug: string, id: string) {
  const session = await getSession();
  if (!session) return null;
  const fandom = await getFandom(slug);
  if (
    !fandom ||
    !canEditContent(await getMemberRole(fandom.id, session.user.id))
  )
    return null;
  const [page] = await db
    .select()
    .from(pages)
    .where(
      and(
        eq(pages.id, id),
        eq(pages.fandomId, fandom.id),
        isNull(pages.deletedAt),
      ),
    )
    .limit(1);
  if (!page) return null;
  return { fandom, page, userId: session.user.id };
}
export async function GET(_request: Request, { params }: Context) {
  const { slug, id } = await params;
  const allowed = await access(slug, id);
  if (!allowed) return Response.json({ error: "Нет доступа" }, { status: 403 });
  return Response.json({
    history: await getPageDesignHistory(allowed.page.id),
  });
}
class Conflict extends Error {}
export async function POST(request: Request, { params }: Context) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Недопустимый источник запроса" },
      { status: 403 },
    );
  const { slug, id } = await params;
  const allowed = await access(slug, id);
  if (!allowed)
    return Response.json(
      { error: "Нет прав на оформление фандома" },
      { status: 403 },
    );
  let json: unknown;
  try {
    json = JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 256000)),
    );
  } catch (error) {
    if (error instanceof PlatformFailure)
      return Response.json({ error: "Нет доступа" }, { status: 403 });
    if (error instanceof BodyTooLarge)
      return Response.json({ error: "Макет слишком большой" }, { status: 413 });
    return Response.json({ error: "Некорректный JSON" }, { status: 400 });
  }
  // Bound nesting before Zod enters the recursive block schema.
  const queue: { value: unknown; depth: number }[] = [
    { value: json, depth: 0 },
  ];
  while (queue.length) {
    const entry = queue.pop();
    if (!entry) break;
    if (entry.depth > 30)
      return Response.json(
        { error: "Слишком много вложенных блоков" },
        { status: 400 },
      );
    if (entry.value && typeof entry.value === "object")
      for (const value of Object.values(entry.value))
        queue.push({ value, depth: entry.depth + 1 });
  }
  const parsed = saveDesignSchema.safeParse(json);
  if (!parsed.success)
    return Response.json(
      {
        error: describeDesignErrors(parsed.error),
      },
      { status: 400 },
    );
  const { document, revision, publish } = parsed.data;
  const countBodies = (blocks: typeof document.data.content): number =>
    blocks.reduce(
      (n, b) =>
        n +
        (b.type === "ArticleBody" ? 1 : 0) +
        (b.type === "Grid" ? countBodies(b.props.content as typeof blocks) : 0),
      0,
    );
  if (countBodies(document.data.content) !== 1)
    return Response.json(
      {
        error:
          "Макет статьи должен содержать ровно один блок «Текст статьи и оглавление»",
      },
      { status: 400 },
    );
  try {
    await db.transaction(async (tx) => {
      const [currentPage] = await tx
        .select()
        .from(pages)
        .where(and(eq(pages.id, allowed.page.id), isNull(pages.deletedAt)))
        .for("update");
      if (!currentPage) throw new Conflict();
      await mutationAccess(tx, allowed.fandom.id, allowed.userId, "edit");
      await tx
        .insert(pageDesigns)
        .values({ pageId: allowed.page.id, draft: document })
        .onConflictDoNothing();
      const [saved] = await tx
        .update(pageDesigns)
        .set({
          draft: document,
          revision: revision + 1,
          updatedAt: new Date(),
          ...(publish
            ? { published: document, publishedRevision: revision + 1 }
            : {}),
        })
        .where(
          and(
            eq(pageDesigns.pageId, allowed.page.id),
            eq(pageDesigns.revision, revision),
          ),
        )
        .returning({ revision: pageDesigns.revision });
      if (!saved) throw new Conflict();
      await tx.insert(pageDesignVersions).values({
        id: crypto.randomUUID(),
        pageId: allowed.page.id,
        revision: saved.revision,
        document,
        published: publish,
        editorId: allowed.userId,
      });
    });
  } catch (error) {
    if (error instanceof Conflict)
      return Response.json(
        {
          error:
            "Макет изменён в другой вкладке. Скопируйте нужный текст и обновите редактор.",
        },
        { status: 409 },
      );
    throw error;
  }
  revalidatePath(`/f/${slug}/wiki/${allowed.page.slug}`);
  return Response.json({ revision: revision + 1, published: publish });
}
