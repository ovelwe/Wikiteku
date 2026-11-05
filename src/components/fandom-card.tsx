import { cookies } from "next/headers";
import Link from "next/link";
import { categoryLabels, type Locale } from "@/lib/i18n";

export async function FandomCard({
  fandom,
}: {
  fandom: {
    slug: string;
    title: string;
    description: string;
    category: string;
    tags?: string[];
    articleCount?: number;
  };
}) {
  const locale: Locale =
    (await cookies()).get("locale")?.value === "en" ? "en" : "ru";
  return (
    <Link className="fandom-card" href={`/f/${fandom.slug}`}>
      <div className="fandom-card-art" aria-hidden="true">
        <span>{fandom.title.slice(0, 1).toUpperCase()}</span>
      </div>
      <div className="fandom-card-body">
        <span className="eyebrow">
          {categoryLabels[locale][fandom.category] ?? fandom.category}
        </span>
        <strong>{fandom.title}</strong>
        <p>{fandom.description}</p>
        <div className="tag-list">
          {fandom.tags?.map((tag) => (
            <span key={tag}>#{tag} </span>
          ))}
        </div>
        <small>
          {locale === "en" ? "Articles" : "Статей"}: {fandom.articleCount ?? 0}
        </small>
      </div>
    </Link>
  );
}
