import { eq, sql } from "drizzle-orm";
import sharp from "sharp";
import { db } from "@/lib/db";
import { media } from "@/lib/db/schema";
import { canEditContent } from "@/lib/permissions";
import {
  type PlatformErrorCode,
  PlatformFailure,
  platformError,
} from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { mutationAccess } from "@/server/mutation-access";
import { BodyTooLarge, boundedBody, sameOrigin } from "@/server/request";
import { getSession } from "@/server/session";

async function failure(code: PlatformErrorCode, status: number) {
  return Response.json(
    { code, error: platformError(code, await getLocale()) },
    { status },
  );
}
export async function POST(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  if (!sameOrigin(request)) return failure("access", 403);
  const session = await getSession();
  const fandom = await getFandom((await params).slug);
  if (
    !session ||
    !fandom ||
    !canEditContent(await getMemberRole(fandom.id, session.user.id))
  )
    return failure("access", 403);
  try {
    const raw = await boundedBody(request, 2 * 1024 * 1024 + 16000);
    const form = await new Request(request.url, {
      method: "POST",
      headers: { "content-type": request.headers.get("content-type") ?? "" },
      body: raw as BodyInit,
    }).formData();
    const file = form.get("file");
    if (!(file instanceof File) || file.size > 2 * 1024 * 1024 || !file.size)
      throw new PlatformFailure("imageSize");
    const input = Buffer.from(await file.arrayBuffer());
    const image = sharp(input, { limitInputPixels: 20_000_000 });
    const meta = await image.metadata();
    if (!["png", "jpeg", "webp"].includes(meta.format ?? ""))
      throw new PlatformFailure("imageFormat");
    const bytes = await image
      .rotate()
      .resize({
        width: 2400,
        height: 2400,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 85 })
      .toBuffer();
    const id = crypto.randomUUID();
    await db.transaction(async (tx) => {
      await mutationAccess(tx, fandom.id, session.user.id, "edit");
      await tx.execute(
        sql`select pg_advisory_xact_lock(hashtext(${`media:${fandom.id}`}))`,
      );
      const [usage] = await tx
        .select({ bytes: sql<number>`coalesce(sum(${media.bytes}),0)` })
        .from(media)
        .where(eq(media.fandomId, fandom.id));
      if (Number(usage.bytes) + bytes.length > 50 * 1024 * 1024)
        throw new PlatformFailure("mediaLimit");
      await tx.insert(media).values({
        id,
        fandomId: fandom.id,
        uploaderId: session.user.id,
        name: file.name.slice(0, 150),
        alt: String(form.get("alt") ?? "").slice(0, 300),
        bytes: bytes.length,
        data: bytes.toString("base64"),
      });
    });
    return Response.json({ url: `/api/media/${id}` });
  } catch (e) {
    return failure(
      e instanceof PlatformFailure
        ? e.code
        : e instanceof BodyTooLarge
          ? "imageSize"
          : "imageFailed",
      e instanceof PlatformFailure && e.code === "access" ? 403 : 400,
    );
  }
}
