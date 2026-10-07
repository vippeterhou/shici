import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { FormatHeatmap } from "@/components/format-heatmap";
import { InsightChart } from "@/components/insight-chart";
import { CorpusStructureInsight } from "@/components/corpus-structure-insight";
import { TextFrequencyExplorer } from "@/components/text-frequency-explorer";
import { getCorpora, getCorpusInsights } from "@/lib/data";
import { formatNumber } from "@/lib/format";

interface InsightPageProps {
  params: Promise<{ corpus: string }>;
}

export const revalidate = 86_400;

export function generateStaticParams() {
  return getCorpora().map((corpus) => ({ corpus: corpus.key }));
}

export async function generateMetadata({
  params,
}: InsightPageProps): Promise<Metadata> {
  const { corpus } = await params;
  const insights = getCorpusInsights(corpus);
  return {
    title: insights ? `${insights.corpus.name}数据洞察` : "数据洞察",
  };
}

export default async function InsightPage({ params }: InsightPageProps) {
  const { corpus: corpusKey } = await params;
  const insights = getCorpusInsights(corpusKey);
  if (!insights) {
    notFound();
  }
  const corpora = getCorpora();
  return (
    <>
      <header className="page-shell page-hero">
        <nav className="breadcrumbs" aria-label="面包屑">
          <Link href="/insights">数据洞察</Link>
          <span>/</span>
          <span>{insights.corpus.name}</span>
        </nav>
        <p className="eyebrow">{insights.corpus.era}</p>
        <h1>{insights.corpus.name} · 数据洞察</h1>
        <p>
          统计基于当前数据版本与文库收录范围，用于观察结构与分布，不作为文学价值判断。
        </p>
        <div className="stats-grid">
          <div className="stat-card">
            <span>作品</span>
            <strong>{formatNumber(insights.stats.poemCount)}</strong>
          </div>
          <div className="stat-card">
            <span>作者</span>
            <strong>{formatNumber(insights.stats.authorCount)}</strong>
          </div>
          <div className="stat-card">
            <span>平均正文长度</span>
            <strong>{Math.round(insights.stats.averageCharacters)} 字</strong>
          </div>
        </div>
      </header>
      <section className="page-shell section">
        <nav className="insight-tabs" aria-label="切换文库">
          {corpora.map((corpus) => (
            <Link
              className={corpus.key === corpusKey ? "active" : undefined}
              href={`/insights/${corpus.key}`}
              key={corpus.key}
            >
              {corpus.name}
            </Link>
          ))}
        </nav>
        <div className="chart-grid">
          <article className="chart-card chart-card-wide">
            <h2>每句字数 × 句数组合</h2>
            <p>
              横轴是作品句数，纵轴是每句字数类型；颜色越深，作品数量越多。
            </p>
            <FormatHeatmap data={insights.formatCombinations} />
          </article>
          {insights.structure ? (
            <CorpusStructureInsight structure={insights.structure} />
          ) : null}
          <article className="chart-card">
            <h2>作品数量较多的作者</h2>
            <p>作者名称按数据原貌统计，别名与简繁体可能分列。</p>
            <InsightChart data={insights.authors} horizontal />
          </article>
          <article className="chart-card">
            <h2>常见句数</h2>
            <p>显示作品数量最多的句数类型。</p>
            <InsightChart data={insights.sentenceCounts} />
          </article>
          <article className="chart-card">
            <h2>每句字数类型</h2>
            <p>整齐句式按字数归类，长短不齐的作品归入杂言。</p>
            <InsightChart data={insights.lineTypes} />
          </article>
          <article className="chart-card chart-card-wide">
            <h2>正文语言频率</h2>
            <p>在同一位置切换观察单字、二字与三字组合，避免重复堆叠图表。</p>
            <TextFrequencyExplorer
              characters={insights.characters}
              bigrams={insights.bigrams}
              trigrams={insights.trigrams}
            />
          </article>
        </div>
      </section>
    </>
  );
}
