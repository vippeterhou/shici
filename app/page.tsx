import Link from "next/link";
import { BarChart3, BookOpenText, Search } from "lucide-react";
import { CorpusCard } from "@/components/corpus-card";
import { SearchForm } from "@/components/search-form";
import { getCorpora, getDailyPoem } from "@/lib/data";
import { poemHref } from "@/lib/format";

export const revalidate = 86_400;

export default function HomePage() {
  const corpora = getCorpora();
  const dailyPoem = getDailyPoem();

  return (
    <>
      <section className="hero">
        <div className="page-shell hero-grid">
          <div>
            <p className="eyebrow">从《诗经》到唐宋</p>
            <h1>循字句，重逢三千年诗意</h1>
            <p className="hero-lede">
              在三十二万余首作品中搜索一句诗、一个名字或一种意象；
              也可以沿时代与文集漫游，安静地读一首诗。
            </p>
            <div className="hero-search">
              <SearchForm />
              <p className="search-hint">
                支持简繁体互搜 · 可搜索题目、作者、词牌、分类与正文
              </p>
            </div>
          </div>
          <article className="daily-card">
            <span className="daily-card-label">今日一首</span>
            <h2>{dailyPoem.title}</h2>
            <p className="daily-author">
              {dailyPoem.author} · {dailyPoem.corpusName}
            </p>
            <p className="daily-excerpt">{dailyPoem.excerpt}</p>
            <Link
              className="text-link"
              href={poemHref(dailyPoem.corpus, dailyPoem.id)}
            >
              展开阅读 →
            </Link>
          </article>
        </div>
      </section>

      <section className="section section-toned">
        <div className="page-shell">
          <div className="section-heading">
            <div>
              <p className="eyebrow">按文库探索</p>
              <h2>从时代与选本出发</h2>
            </div>
            <p>
              每个文库拥有独立的浏览、筛选与数据概览；全库搜索则始终覆盖全部作品。
            </p>
          </div>
          <div className="corpus-grid">
            {corpora.map((corpus) => (
              <CorpusCard corpus={corpus} key={corpus.key} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-spaced page-shell">
        <div className="section-heading">
          <div>
            <p className="eyebrow">一种更自然的路径</p>
            <h2>找得到，也读得进去</h2>
          </div>
        </div>
        <div className="principle-grid">
          <article className="surface-card">
            <Search aria-hidden />
            <h3>先搜索，再缩小范围</h3>
            <p>简繁体自动匹配，用文库筛选结果，不必先猜作品属于哪里。</p>
          </article>
          <article className="surface-card">
            <BookOpenText aria-hidden />
            <h3>让正文成为主角</h3>
            <p>专注阅读页弱化工具与图表，保留出处、篇章和结构信息。</p>
          </article>
          <article className="surface-card">
            <BarChart3 aria-hidden />
            <h3>需要时再看数据</h3>
            <p>作者、句式与字频进入独立洞察空间，不打断日常浏览。</p>
          </article>
        </div>
      </section>
    </>
  );
}
