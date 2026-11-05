import Link from "next/link";
import { FandomCard } from "@/components/fandom-card";
import { categoryLabels } from "@/lib/i18n";
import { platformCopy } from "@/lib/platform-copy";
import { validPage } from "@/lib/validation";
import { getLocale } from "@/server/community";
import { listFandoms } from "@/server/fandoms";

export async function generateMetadata() {
  return { title: platformCopy[await getLocale()].directory };
}
export default async function Explore({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string;
    q?: string;
    category?: string;
    sort?: string;
  }>;
}) {
  const params = await searchParams;
  const locale = await getLocale();
  const t = platformCopy[locale];
  const page = validPage(params.page);
  const query = (params.q ?? "").slice(0, 100);
  const category = (params.category ?? "").slice(0, 30);
  const sort =
    params.sort === "new" || params.sort === "popular" ? params.sort : "active";
  const result = await listFandoms({ page, query, category, sort });
  const path = (next: number) =>
    `/explore?${new URLSearchParams({ q: query, category, sort, page: String(next) })}`;
  return (
    <div className="stack">
      <div className="section-head">
        <div>
          <h1>{t.directory}</h1>
        </div>
        <Link className="button primary" href="/create">
          ＋ {t.createFandom}
        </Link>
      </div>
      <form className="panel filter-form" action="/explore">
        <input
          name="q"
          placeholder={t.titleOrDescription}
          defaultValue={query}
          aria-label={t.searchFandoms}
        />
        <select name="category" defaultValue={category} aria-label={t.category}>
          <option value="">{t.allCategories}</option>
          {Object.entries(categoryLabels[locale]).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select name="sort" defaultValue={sort} aria-label={t.sort}>
          <option value="active">{t.active}</option>
          <option value="new">{t.new}</option>
          <option value="popular">{t.popular}</option>
        </select>
        <button className="button primary" type="submit">
          {t.find}
        </button>
      </form>
      <div className="fandom-grid">
        {result.items.map((fandom) => (
          <FandomCard fandom={fandom} key={fandom.id} />
        ))}
      </div>
      {!result.items.length && <div className="panel empty">{t.noFandoms}</div>}
      <div className="pagination">
        {page > 1 && <Link href={path(page - 1)}>{t.back}</Link>}
        {page * 12 < result.total && (
          <Link href={path(page + 1)}>{t.next}</Link>
        )}
      </div>
    </div>
  );
}
