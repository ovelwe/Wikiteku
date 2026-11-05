import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { fandoms, media } from "@/lib/db/schema";
import { canReadFandom } from "@/lib/permissions";
import { getMemberRole } from "@/server/fandoms";
import { getSession } from "@/server/session";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const [row] = await db
    .select({ file: media, visibility: fandoms.visibility })
    .from(media)
    .innerJoin(fandoms, eq(media.fandomId, fandoms.id))
    .where(eq(media.id, id))
    .limit(1);
  if (!row) return new Response(null, { status: 404 });
  const session = await getSession();
  if (
    !canReadFandom(
      row.visibility,
      await getMemberRole(row.file.fandomId, session?.user.id),
    )
  )
    return new Response(null, { status: 404 });
  return new Response(new Uint8Array(Buffer.from(row.file.data, "base64")), {
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
      "Content-Disposition": `inline; filename="${id}.webp"`,
    },
  });
}
