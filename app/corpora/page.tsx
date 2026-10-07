import type { Metadata } from "next";
import { CorpusCard } from "@/components/corpus-card";
import { getCorpora } from "@/lib/data";

export const metadata: Metadata = {
  title: "文库",
  description: "按时代、总集与选本探索中国古典诗词。",
};

export const revalidate = 86_400;

export default function CorporaPage() {
  const corpora = getCorpora();
  return (
    <>
      <header className="page-shell page-hero">
        <p className="eyebrow">八座文库</p>
        <h1>沿着诗歌的时间漫游</h1>
        <p>
          小型选本适合从经典入门，大型总集适合深入检索。每座文库都有自己的浏览与洞察页面。
        </p>
      </header>
      <section className="page-shell section">
        <div className="corpus-grid">
          {corpora.map((corpus) => (
            <CorpusCard corpus={corpus} key={corpus.key} />
          ))}
        </div>
      </section>
    </>
  );
}
