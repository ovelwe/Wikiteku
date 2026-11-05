import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { describeDesignErrors, saveDesignSchema } from "@/lib/builder";
import { db } from "@/lib/db";
import { designVersions, fandomDesigns } from "@/lib/db/schema";
import { canManageFandom } from "@/lib/permissions";
import { PlatformFailure } from "@/lib/platform-copy";
import { getDesignHistory } from "@/server/designs";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { mutationAccess } from "@/server/mutation-access";
import { BodyTooLarge, boundedBody, sameOrigin } from "@/server/request";
import { getSession } from "@/server/session";

type Context = { params: Promise<{ slug: string }> };
async function access(slug: string) {
  const session = await getSession();
  if (!session) return null;
  const fandom = await getFandom(slug);
  if (
    !fandom ||
    !canManageFandom(await getMemberRole(fandom.id, session.user.id))
  )
    return null;
  return { fandom, userId: session.user.id };
}
export async function GET(_request: Request, { params }: Context) {
  const allowed = await access((await params).slug);
  if (!allowed) return Response.json({ error: "Нет доступа" }, { status: 403 });
  return Response.json({ history: await getDesignHistory(allowed.fandom.id) });
}
class Conflict extends Error {}
export async function POST(request: Request, { params }: Context) {
  if (!sameOrigin(request))
    return Response.json(
      { error: "Недопустимый источник запроса" },
      { status: 403 },
    );
  const { slug } = await params;
  const allowed = await access(slug);
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
  try {
    await db.transaction(async (tx) => {
      await mutationAccess(tx, allowed.fandom.id, allowed.userId, "manage");
      await tx
        .insert(fandomDesigns)
        .values({ fandomId: allowed.fandom.id, draft: document })
        .onConflictDoNothing();
      const [saved] = await tx
        .update(fandomDesigns)
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
            eq(fandomDesigns.fandomId, allowed.fandom.id),
            eq(fandomDesigns.revision, revision),
          ),
        )
        .returning({ revision: fandomDesigns.revision });
      if (!saved) throw new Conflict();
      await tx.insert(designVersions).values({
        id: crypto.randomUUID(),
        fandomId: allowed.fandom.id,
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
  revalidatePath(`/f/${slug}`);
  return Response.json({ revision: revision + 1, published: publish });
}
