import {
  decisionInput,
  ModerationFailure,
  reportInput,
} from "@/lib/moderation";
import {
  decideReport,
  isPlatformModerator,
  submitReport,
} from "@/server/moderation";
import { boundedBody, sameOrigin } from "@/server/request";
import { getSession } from "@/server/session";

async function mutate(request: Request, decision: boolean) {
  if (!sameOrigin(request))
    return Response.json({ error: "access" }, { status: 403 });
  const session = await getSession();
  if (!session) return Response.json({ error: "access" }, { status: 401 });
  if (decision && !isPlatformModerator(session.user.id))
    return Response.json({ error: "access" }, { status: 403 });
  let raw: unknown;
  try {
    raw = JSON.parse(
      new TextDecoder().decode(await boundedBody(request, 16000)),
    );
  } catch {
    return Response.json({ error: "invalid" }, { status: 400 });
  }
  try {
    if (decision) {
      const parsed = decisionInput.safeParse(raw);
      if (!parsed.success)
        return Response.json({ error: "invalid" }, { status: 400 });
      await decideReport(session.user.id, parsed.data);
    } else {
      const parsed = reportInput.safeParse(raw);
      if (!parsed.success)
        return Response.json({ error: "invalid" }, { status: 400 });
      await submitReport(session.user.id, parsed.data);
    }
    return Response.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return Response.json(
      {
        error: error instanceof ModerationFailure ? error.code : "unavailable",
      },
      { status: error instanceof ModerationFailure ? error.status : 503 },
    );
  }
}
export async function POST(request: Request) {
  return mutate(request, false);
}
export async function PATCH(request: Request) {
  return mutate(request, true);
}
