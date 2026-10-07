import type { Metadata } from "next";
import Link from "next/link";
import { BarChart3 } from "lucide-react";
import { getCorpora } from "@/lib/data";

export const metadata: Metadata = {
  title: "数据洞察",
  description: "从作者、句式、结构和用字观察不同诗词文库。",
};

export const revalidate = 86_400;

export default function InsightsPage() {
  const corpora = getCorpora();
  return (
    <>
      <header className="page-shell page-hero">
        <p className="eyebrow">数据洞察</p>
        <h1>换一种尺度读诗</h1>
        <p>
          洞察服务于理解，而不是替代阅读。选择一个文库，观察作者、句式、结构与常用字的分布。
        </p>
      </header>
      <section className="page-shell section">
        <div className="surface-card insight-intro">
          <BarChart3 aria-hidden />
          <h3>先选择文库</h3>
          <p>
            不同来源的收录范围与整理方式不同，因此统计始终标明文库，不把不可比的数据混在一起。
          </p>
        </div>
        <div className="corpus-grid">
          {corpora.map((corpus) => (
            <Link
              className="corpus-card"
              href={`/insights/${corpus.key}`}
              key={corpus.key}
            >
              <span className="corpus-era">{corpus.era}</span>
              <h3>{corpus.name}</h3>
              <p>{corpus.description}</p>
              <span className="corpus-count">查看统计与分布 →</span>
            </Link>
          ))}
        </div>
      </section>
    </>
  );
}
