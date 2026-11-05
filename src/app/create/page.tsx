import { createFandom } from "@/app/actions";
import { categoryLabels } from "@/lib/i18n";
import { platformCopy, platformError } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
import { requireUser } from "@/server/session";
export async function generateMetadata() {
  return { title: platformCopy[await getLocale()].createFandom };
}
export default async function Create({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  await requireUser();
  const locale = await getLocale();
  const t = platformCopy[locale];
  const { error } = await searchParams;
  return (
    <div className="narrow stack">
      <div>
        <h1>{t.createFandom}</h1>
        <p className="muted">{t.createIntro}</p>
      </div>
      <form action={createFandom} className="panel stack form-card">
        <label>
          {t.title}
          <input name="title" minLength={3} maxLength={100} required />
        </label>
        <label>
          {t.fandomAddress} <small>{t.addressHelp}</small>
          <input
            name="slug"
            pattern="[a-zA-Z0-9][a-zA-Z0-9-]{1,46}[a-zA-Z0-9]"
            minLength={3}
            maxLength={48}
            required
          />
        </label>
        <label>
          {t.description}
          <textarea
            name="description"
            minLength={10}
            maxLength={2000}
            required
          />
        </label>
        <label>
          {t.tags} <small>{t.tagsHelp}</small>
          <input name="tags" maxLength={500} placeholder={t.tagsExample} />
        </label>
        <label>
          {t.category}
          <select name="category" defaultValue="games">
            {Object.entries(categoryLabels[locale]).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t.language}
          <select name="language" defaultValue="ru">
            <option value="ru">{t.russian}</option>
            <option value="en">English</option>
          </select>
        </label>
        <label>
          {t.visibility}
          <select name="visibility" defaultValue="public">
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
          {t.createFandom}
        </button>
      </form>
    </div>
  );
}
