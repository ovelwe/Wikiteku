import { eq } from "drizzle-orm";
import Link from "next/link";
import { updateProfile } from "@/app/actions";
import { db } from "@/lib/db";
import { profiles } from "@/lib/db/schema";
import { moderationCopy } from "@/lib/moderation";
import { platformCopy, platformError } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
import { isPlatformModerator } from "@/server/moderation";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return { title: platformCopy[await getLocale()].settings };
}
export default async function Settings({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const current = await requireUser();
  const locale = await getLocale();
  const t = platformCopy[locale];
  const moderation = moderationCopy[locale];
  const { error } = await searchParams;
  const [profile] = await db
    .select()
    .from(profiles)
    .where(eq(profiles.userId, current.id))
    .limit(1);
  return (
    <div className="narrow stack">
      <div>
        <h1>{t.settings}</h1>
        <p className="muted">{t.profileHelp}</p>
      </div>
      <nav className="wiki-tools" aria-label={moderation.mine}>
        <Link href="/reports">{moderation.mine}</Link>
        {isPlatformModerator(current.id) && (
          <Link href="/moderation">{moderation.queue}</Link>
        )}
      </nav>
      <form action={updateProfile} className="panel stack form-card">
        <label>
          {t.name}
          <input
            name="name"
            defaultValue={current.name}
            minLength={2}
            maxLength={80}
            required
          />
        </label>
        <label>
          {t.username}
          <input
            value={current.username ?? ""}
            readOnly
            aria-label={t.username}
          />
          <small>{t.usernameHelp}</small>
        </label>
        <label>
          {t.bio}
          <textarea
            name="bio"
            defaultValue={profile?.bio ?? ""}
            maxLength={1000}
          />
        </label>
        {error && (
          <p className="error" role="alert">
            {platformError(error, locale)}
          </p>
        )}
        <button className="button primary" type="submit">
          {t.saveProfile}
        </button>
      </form>
    </div>
  );
}
