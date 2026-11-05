import { z } from "zod";
import { canEditContent } from "@/lib/permissions";
import { PlatformFailure } from "@/lib/platform-copy";
import {
  TranslationFailure,
  translationCorrection,
  translationRequest,
} from "@/lib/translation";
import { slugSchema } from "@/lib/validation";
import { BodyTooLarge, boundedBody, sameOrigin } from "@/server/request";
import {
  generateTranslation,
  saveTranslationCorrection,
  translationContext,
} from "@/server/translations";

export const runtime = "nodejs";
type Context = { params: Promise<{ slug: string; id: string }> };
async function mutate(request: Request, context: Context, correction: boolean) {
  if (!sameOrigin(request))
    return Response.json({ error: "access" }, { status: 403 });
  try {
    const route = z
      .object({ slug: slugSchema, id: z.string().uuid() })
      .safeParse(await context.params);
    if (!route.success)
      return Response.json({ error: "invalid" }, { status: 400 });
    const { slug, id } = route.data;
    const current = await translationContext(slug, id);
    if (!current) return Response.json({ error: "access" }, { status: 404 });
    if (!current.session)
      return Response.json({ error: "login" }, { status: 401 });
    if (correction && !canEditContent(current.role))
      return Response.json({ error: "access" }, { status: 403 });
    const raw = JSON.parse(
      new TextDecoder().decode(
        await boundedBody(request, correction ? 400000 : 1000),
      ),
    );
    const parsed = (
      correction ? translationCorrection : translationRequest
    ).safeParse(raw);
    if (!parsed.success)
      return Response.json({ error: "invalid" }, { status: 400 });
    const { source, target, revision } = parsed.data;
    if (current.page.revision !== revision)
      throw new TranslationFailure("changed");
    if (correction) {
      const body = translationCorrection.parse(raw);
      await saveTranslationCorrection(
        current.page,
        current.session.user.id,
        source,
        target,
        body.version,
        body.content,
      );
    } else
      await generateTranslation(
        current.page,
        current.session.user.id,
        source,
        target,
      );
    // Recheck access and revision after the provider call. No translated content is returned here.
    const after = await translationContext(slug, id);
    if (!after || after.page.revision !== revision)
      throw new TranslationFailure("changed");
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof PlatformFailure)
      return Response.json({ error: "access" }, { status: 403 });
    const code =
      error instanceof TranslationFailure
        ? error.code
        : error instanceof SyntaxError || error instanceof BodyTooLarge
          ? "invalid"
          : "unavailable";
    return Response.json(
      { error: code },
      {
        status:
          code === "changed" || code === "busy"
            ? 409
            : code === "limit"
              ? 429
              : code === "structure" || code === "invalid"
                ? 400
                : 503,
      },
    );
  }
}
export async function POST(request: Request, context: Context) {
  return mutate(request, context, false);
}
export async function PATCH(request: Request, context: Context) {
  return mutate(request, context, true);
}
