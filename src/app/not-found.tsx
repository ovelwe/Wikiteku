import Link from "next/link";
import { platformCopy } from "@/lib/platform-copy";
import { getLocale } from "@/server/community";
export default async function NotFound() {
  const locale = await getLocale();
  const labels = platformCopy[locale];
  return (
    <div className="panel narrow">
      <h1>{labels.notFound}</h1>
      <p className="muted">{labels.notFoundHelp}</p>
      <Link href="/">{labels.home} →</Link>
    </div>
  );
}
