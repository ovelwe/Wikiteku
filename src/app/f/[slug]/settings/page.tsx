import { eq } from "drizzle-orm";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { addMember, updateFandom } from "@/app/actions";
import { db } from "@/lib/db";
import { fandomMembers, user } from "@/lib/db/schema";
import { categoryLabels } from "@/lib/i18n";
import { canManageFandom } from "@/lib/permissions";
import { platformCopy, platformError } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { requireUser } from "@/server/session";

export async function generateMetadata() {
  return { title: platformCopy[await getLocale()].fandomSettings };
}
export default async function FandomSettings({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { slug } = await params;
  const { error } = await searchParams;
  const current = await requireUser();
  const locale = await getLocale();
  const t = platformCopy[locale];
  const fandom = await getFandom(slug);
  if (!fandom) notFound();
  const actorRole = await getMemberRole(fandom.id, current.id);
  if (!canManageFandom(actorRole)) redirect(`/f/${slug}`);
  const members = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      role: fandomMembers.role,
    })
    .from(fandomMembers)
    .innerJoin(user, eq(fandomMembers.userId, user.id))
    .where(eq(fandomMembers.fandomId, fandom.id));
  return (
    <div className="narrow stack">
      <Link href={`/f/${slug}`}>← {fandom.title}</Link>
      <h1>{t.fandomSettings}</h1>
      <form
        action={updateFandom.bind(null, slug)}
        className="panel stack form-card"
      >
        <label>
          {t.title}
          <input
            name="title"
            defaultValue={fandom.title}
            minLength={3}
            maxLength={100}
            required
          />
        </label>
        <label>
          {t.description}
          <textarea
            name="description"
            defaultValue={fandom.description}
            minLength={10}
            maxLength={2000}
            required
          />
        </label>
        <label>
          {t.tags} <small>{t.tagsHelp}</small>
          <input
            name="tags"
            maxLength={500}
            defaultValue={fandom.tags.join(", ")}
            placeholder={t.tagsExample}
          />
        </label>
        <label>
          {t.category}
          <select name="category" defaultValue={fandom.category}>
            {Object.entries(categoryLabels[locale]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.language}
          <select name="language" defaultValue={fandom.language}>
            <option value="ru">{t.russian}</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t.visibility}
          <select name="visibility" defaultValue={fandom.visibility}>
            <option value="public">{t.public}</option>
            <option value="unlisted">{t.unlisted}</option>
            <option value="private">{t.private}</option>
          </select>
        </label>
        {error && (
          <p className="error" role="alert">
            {platformError(error, locale)}
          </p>
        )}
        <button className="button primary" type="submit">
          {t.saveSettings}
        </button>
      </form>
      <section className="panel stack">
        <h2>{t.members}</h2>
        {members.map((member) => (
          <div key={member.id}>
            {member.name} (@{member.username}) · {t[member.role]}
          </div>
        ))}
        <form action={addMember.bind(null, slug)} className="stack form-card">
          <label>
            {t.username}
            <input name="username" pattern="[a-zA-Z0-9_]{3,24}" required />
          </label>
          <label>
            {t.role}
            <select name="role">
              <option value="reader">{t.reader}</option>
              <option value="editor">{t.editor}</option>
              {actorRole === "owner" && (
                <option value="admin">{t.admin}</option>
              )}
            </select>
          </label>
          <button className="button" type="submit">
            {t.addMember}
          </button>
        </form>
      </section>
    </div>
  );
}
