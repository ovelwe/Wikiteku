import { cookies } from "next/headers";
import Link from "next/link";
import { FandomCard } from "@/components/fandom-card";
import { MotionSurface } from "@/components/motion-surface";
import { latestArticles, listFandoms } from "@/server/fandoms";

export default async function Home() {
  const en = (await cookies()).get("locale")?.value === "en";
  const [articles, fandoms] = await Promise.all([
    latestArticles(),
    listFandoms(),
  ]);
  return (
    <MotionSurface>
      <section className="craft-hero">
        <h1>
          {en ? "Every obsession deserves" : "У каждой истории"}
          <br />
          <em>{en ? "a world of its own." : "есть свой мир."}</em>
        </h1>
        <p>
          {en
            ? "Bring your knowledge, people and ideas together. Create a wiki that feels entirely yours."
            : "Соберите знания, людей и идеи в одном месте. Создайте вики, в которой всё — по-вашему."}
        </p>
        <div className="craft-actions">
          <Link className="button primary" href="/create">
            {en ? "Create your world" : "Создать свой мир"} <span>↗</span>
          </Link>
          <Link className="button" href="/explore">
            {en ? "Explore communities" : "Найти сообщество"} →
          </Link>
        </div>
        <section
          className="craft-showcase"
          aria-label={en ? "Design possibilities" : "Возможности оформления"}
        >
          <div className="showcase-top">
            <span>W / STUDIO</span>
            <span>
              {en ? "YOUR WORLD. YOUR RULES." : "ВАШ МИР. ВАШИ ПРАВИЛА."}
            </span>
            <span>↗</span>
          </div>
          <div className="showcase-grid">
            <div className="showcase-story showcase-space">
              <div className="planet-art" aria-hidden="true">
                <i />
                <b />
              </div>
              <span className="showcase-label">
                01 / {en ? "DISCOVER" : "ОТКРЫВАЙТЕ"}
              </span>
              <div>
                <small>
                  {en ? "FAR BEYOND THE KNOWN" : "ЗА ПРЕДЕЛАМИ ИЗВЕСТНОГО"}
                </small>
                <h2>
                  {en ? "Atlas of" : "Атлас"}
                  <br />
                  {en ? "new worlds" : "новых миров"}
                </h2>
                <span className="showcase-pill">
                  {en
                    ? "A universe of possibilities"
                    : "Вселенная возможностей"}{" "}
                  ↗
                </span>
              </div>
            </div>
            <div className="showcase-story showcase-paper">
              <span className="showcase-label">
                02 / {en ? "COLLECT" : "СОБИРАЙТЕ"}
              </span>
              <div className="paper-emblem" aria-hidden="true">
                ✳
              </div>
              <div>
                <small>THE WIKITEKU JOURNAL</small>
                <h2>
                  {en ? "Stories worth" : "Истории,"}
                  <br />
                  <em>{en ? "keeping." : "которые рядом."}</em>
                </h2>
                <p>
                  {en
                    ? "Characters. Places. Details."
                    : "Персонажи. Места. Детали."}
                </p>
              </div>
            </div>
            <div className="showcase-story showcase-type">
              <span className="showcase-label">
                03 / {en ? "CREATE" : "СОЗДАВАЙТЕ"}
              </span>
              <div className="type-specimen" aria-hidden="true">
                Аа<span>Бб Вв Гг Дд Ее</span>
              </div>
              <div>
                <h2>{en ? "Your signature." : "Ваш почерк."}</h2>
                <p>
                  {en
                    ? "15 fonts. Endless combinations."
                    : "15 шрифтов. Тысячи сочетаний."}
                </p>
                <div className="palette-dots" aria-hidden="true">
                  <i />
                  <i />
                  <i />
                  <i />
                </div>
              </div>
            </div>
          </div>
          <div className="showcase-bottom">
            <span>{en ? "Design examples" : "Примеры оформления"}</span>
            <span>
              {en
                ? "From the first idea to a whole universe"
                : "От первой идеи до целой вселенной"}{" "}
              ↗
            </span>
          </div>
        </section>
      </section>
      <section
        className="manifesto-strip reveal"
        aria-label={en ? "Features" : "Возможности"}
      >
        <div>
          <span>{en ? "01 / COLLECT" : "01 / СОБИРАЙТЕ"}</span>
          <strong>{en ? "Keep the lore" : "Собирайте знания"}</strong>
        </div>
        <div>
          <span>{en ? "02 / CREATE" : "02 / СОЗДАВАЙТЕ"}</span>
          <strong>{en ? "Design your space" : "Меняйте привычное"}</strong>
        </div>
        <div>
          <span>{en ? "03 / CONNECT" : "03 / ОБЪЕДИНЯЙТЕСЬ"}</span>
          <strong>{en ? "Find your people" : "Находите своих"}</strong>
        </div>
      </section>
      <section className="discovery-section reveal" id="worlds">
        <div className="section-head">
          <div>
            <h2>
              {en ? "Every world has a story." : "За каждым миром — история."}
            </h2>
          </div>
          <Link className="text-link" href="/explore">
            {en ? "All communities" : "Все сообщества"} ↗
          </Link>
        </div>
        <div className="world-grid">
          {fandoms.items.slice(0, 3).map((f) => (
            <FandomCard key={f.id} fandom={f} />
          ))}
        </div>
        {!fandoms.items.length && (
          <div className="empty panel">
            {en
              ? "The first universe could be yours."
              : "Первой вселенной здесь может стать ваша."}{" "}
            <Link href="/create">{en ? "Create it →" : "Создать →"}</Link>
          </div>
        )}
      </section>
      <section className="studio-teaser reveal">
        <div>
          <h2>{en ? "A world with character." : "Мир со своим характером."}</h2>
          <p>
            {en
              ? "Build your fandom homepage from blocks. Choose a theme, change the composition, make it feel like home."
              : "Соберите главную фандома из блоков. Выберите тему, измените композицию, добавьте свой характер."}
          </p>
          <Link className="button primary" href="/create">
            {en ? "Start creating" : "Начать создавать"} ↗
          </Link>
        </div>
        <div className="composition-art" aria-hidden="true">
          <div className="art-toolbar">
            <i />
            <i />
            <i />
          </div>
          <div className="art-title">
            {en ? "YOUR" : "ВАША"}
            <br />
            <em>{en ? "UNIVERSE." : "ВСЕЛЕННАЯ."}</em>
          </div>
          <div className="art-cards">
            <span>✦</span>
            <span>◎</span>
            <span>↗</span>
          </div>
          <div className="art-cursor">
            ↖ <span>{en ? "Your idea" : "Ваша идея"}</span>
          </div>
          <span className="art-tag">
            {en ? "DRAG. DROP. CREATE." : "СОБИРАЙТЕ. МЕНЯЙТЕ. ТВОРИТЕ."}
          </span>
        </div>
      </section>
      <section className="discovery-section reveal">
        <div className="section-head">
          <div>
            <h2>{en ? "The story continues." : "История продолжается."}</h2>
          </div>
          <Link className="text-link" href="/search">
            {en ? "Find an article" : "Найти статью"} ↗
          </Link>
        </div>
        <div className="editorial-list">
          {articles.slice(0, 5).map((article, index) => (
            <Link
              className="editorial-row"
              href={`/f/${article.fandomSlug}/wiki/${article.slug}`}
              key={article.id}
            >
              <span className="row-index">0{index + 1}</span>
              <div>
                <h3>{article.title}</h3>
                <p>{article.summary}</p>
              </div>
              <span className="row-arrow">↗</span>
            </Link>
          ))}
        </div>
        {!articles.length && (
          <p className="muted">
            {en
              ? "The first chapter is still unwritten."
              : "Первая глава ещё не написана."}
          </p>
        )}
      </section>
      <footer className="site-footer">
        <Link className="brand" href="/">
          ✳ Wikiteku
        </Link>
        <span>
          {en
            ? "Made for the worlds you love."
            : "Для миров, которые вы любите."}
        </span>
        <a href="#main-content">{en ? "Back to top" : "Наверх"} ↑</a>
      </footer>
    </MotionSurface>
  );
}
