import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";
import { registrationState, signupInput } from "@/lib/registration";
import { boundedBody, sameOrigin } from "@/server/request";

const handler = toNextJsHandler(auth);
export const GET = handler.GET;
export async function POST(request: Request) {
  if (new URL(request.url).pathname.endsWith("/sign-up/email")) {
    const registration = registrationState(process.env);
    if (!registration.open)
      return Response.json(
        {
          code: "REGISTRATION_CLOSED",
          message:
            "Registration is closed until email verification is configured.",
        },
        { status: 403 },
      );
    if (!sameOrigin(request))
      return Response.json({ code: "ACCESS_DENIED" }, { status: 403 });
    try {
      const parsed = signupInput.safeParse(
        JSON.parse(new TextDecoder().decode(await boundedBody(request, 16000))),
      );
      if (!parsed.success)
        return Response.json(
          { code: "INVALID_SIGN_UP_INPUT" },
          { status: 400 },
        );
      const { website: _website, ...data } = parsed.data;
      const headers = new Headers(request.headers);
      headers.delete("content-length");
      return handler.POST(
        new Request(request.url, {
          method: "POST",
          headers,
          body: JSON.stringify({ ...data, callbackURL: "/login?verified=1" }),
        }),
      );
    } catch {
      return Response.json({ code: "INVALID_SIGN_UP_INPUT" }, { status: 400 });
    }
  }
  return handler.POST(request);
}
