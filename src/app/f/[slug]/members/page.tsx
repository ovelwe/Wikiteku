import { and, asc, eq } from "drizzle-orm";
import Link from "next/link";
import { notFound } from "next/navigation";
import { communityCopy } from "@/lib/community";
import { db } from "@/lib/db";
import { fandomMembers, user } from "@/lib/db/schema";
import { canManageFandom, canReadFandom } from "@/lib/permissions";
import { validPage } from "@/lib/validation";
import { getLocale } from "@/server/community";
import { getFandom, getMemberRole } from "@/server/fandoms";
import { getSession } from "@/server/session";

export async function generateMetadata() {
  return {
    title: communityCopy[await getLocale()].members,
    robots: { index: false },
  };
}
export default async function Members({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const { slug } = await params;
  const [session, fandom, locale] = await Promise.all([
    getSession(),
    getFandom(slug),
    getLocale(),
  ]);
  if (!fandom) notFound();
  const role = await getMemberRole(fandom.id, session?.user.id);
  if (!canReadFandom(fandom.visibility, role)) notFound();
  const page = validPage((await searchParams).page);
  const members = await db
    .select({
      id: user.id,
      name: user.name,
      username: user.username,
      role: fandomMembers.role,
    })
    .from(fandomMembers)
    .innerJoin(user, eq(user.id, fandomMembers.userId))
    .where(and(eq(fandomMembers.fandomId, fandom.id)))
    .orderBy(asc(fandomMembers.createdAt), asc(user.id))
    .limit(31)
    .offset((page - 1) * 30);
  const t = communityCopy[locale];
  return (
    <div className="community-page stack">
      <Link href={`/f/${slug}`}>← {fandom.title}</Link>
      <div>
        <h1>{t.members}</h1>
        <p className="muted">{t.membersIntro}</p>
      </div>
      {canManageFandom(role) && (
        <Link href={`/f/${slug}/settings`}>{t.manage} →</Link>
      )}
      <div className="panel member-list">
        {members.slice(0, 30).map((member) => (
          <div className="member-row" key={member.id}>
            <div>
              <strong>
                {member.username ? (
                  <Link href={`/u/${member.username}`}>{member.name}</Link>
                ) : (
                  member.name
                )}
              </strong>
              {member.username && (
                <small className="muted">@{member.username}</small>
              )}
            </div>
            <span className="member-role">{t.roles[member.role]}</span>
          </div>
        ))}
      </div>
      <nav className="pagination" aria-label={t.members}>
        {page > 1 && <Link href={`?page=${page - 1}`}>← {t.back}</Link>}
        {members.length > 30 && (
          <Link href={`?page=${page + 1}`}>{t.next} →</Link>
        )}
      </nav>
    </div>
  );
}
