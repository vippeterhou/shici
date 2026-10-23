import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdvancedSearchForm } from "@/components/advanced-search-form";
import { CorpusAnalysis } from "@/components/corpus-analysis";
import { getCorpora, getCorpusSearchOptions, getCorpusStats, getFilteredAuthorOptions, getFilteredCorpusInsights } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import {
  parseSearchFilters,
  poemFilterOptions,
  validateSearchFilters,
  type FilterParameters,
} from "@/lib/search-filters";

export const metadata: Metadata = {
  title: "统计分析",
  description: "按文库、作者、关键词、格式与句数筛选，分析相同作品的作者、结构与正文语言频率。",
};

export default async function InsightsPage({
  searchParams,
}: {
  searchParams: Promise<FilterParameters>;
}) {
  const { corpus: corpusKey, values } = parseSearchFilters(await searchParams);
  const corpora = getCorpora();
  const corpus = corpora.find((item) => item.key === corpusKey);
  const stats = corpus ? getCorpusStats(corpus.key) : null;
  if (!corpus || !stats) notFound();
  const options = getCorpusSearchOptions(corpus.key);
  const error = validateSearchFilters(
    values,
    options.lineTypes.map((item) => item.label),
    options.sentenceCounts.map((item) => item.label),
  );
  const insights = error ? null : getFilteredCorpusInsights(
    values.query,
    poemFilterOptions(corpus.key, values),
  );
  if (!error && !insights) notFound();

  return (
    <div className="page-shell advanced-page">
      <header className="advanced-heading">
        <h1>统计分析</h1>
      </header>
      <AdvancedSearchForm
        action="/insights"
        corpora={corpora}
        corpus={corpus}
        stats={insights?.stats ?? null}
        authors={error ? options.authors : getFilteredAuthorOptions(values.query, poemFilterOptions(corpus.key, values))}
        lineTypes={options.lineTypes}
        sentenceCounts={options.sentenceCounts}
        values={values}
      />
      {insights ? (
        <section className="advanced-results" aria-label="筛选结果统计">
          <div className="results-summary">
            <p role="status">找到 {formatNumber(insights.stats.poemCount)} 首作品</p>
            <p>
              {formatNumber(insights.stats.authorCount)} 位作者
              {" · "}平均正文长度 {Math.round(insights.stats.averageCharacters)} 字
            </p>
          </div>
          {insights.stats.poemCount ? (
            <CorpusAnalysis insights={insights} />
          ) : (
            <div className="empty-state">
              <h2>没有找到相符的作品</h2>
              <p>试试减少筛选条件，或选择其他文库。</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
