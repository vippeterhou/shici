import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AdvancedSearchForm } from "@/components/advanced-search-form";
import { Pagination } from "@/components/pagination";
import { PoemCard } from "@/components/poem-card";
import { getCorpora, getCorpusSearchOptions, getCorpusStats, getFilteredAuthorOptions, getFilteredCorpusStats, searchPoems } from "@/lib/data";
import { formatNumber } from "@/lib/format";
import {
  filterHref,
  parseSearchFilters,
  poemFilterOptions,
  validateSearchFilters,
  type FilterParameters,
} from "@/lib/search-filters";

export const metadata: Metadata = {
  title: "高级搜索",
  description: "按文库、关键词、作者、格式与句数筛选中国古典诗词。",
};

export default async function CorporaPage({
  searchParams,
}: {
  searchParams: Promise<FilterParameters>;
}) {
  const { corpus: corpusKey, values, page } = parseSearchFilters(await searchParams);
  const corpora = getCorpora();
  const corpus = corpora.find((item) => item.key === corpusKey);
  const stats = corpus ? getCorpusStats(corpus.key) : null;
  if (!corpus || !stats) notFound();
  const selectedCorpusKey = corpus.key;
  const options = getCorpusSearchOptions(corpus.key);
  const error = validateSearchFilters(
    values,
    options.lineTypes.map((item) => item.label),
    options.sentenceCounts.map((item) => item.label),
  );
  const response = error ? null : searchPoems(values.query, {
    ...poemFilterOptions(corpus.key, values),
    page,
  });
  const filteredStats = error ? null : getFilteredCorpusStats(
    values.query,
    poemFilterOptions(corpus.key, values),
  );

  function resultHref(page: number) {
    return filterHref("/corpora", selectedCorpusKey, values, page);
  }

  return (
    <div className="page-shell advanced-page">
      <header className="advanced-heading">
        <h1>高级搜索</h1>
      </header>
      <AdvancedSearchForm
        corpora={corpora}
        corpus={corpus}
        stats={filteredStats}
        authors={error ? options.authors : getFilteredAuthorOptions(values.query, poemFilterOptions(corpus.key, values))}
        lineTypes={options.lineTypes}
        sentenceCounts={options.sentenceCounts}
        values={values}
      />
      {response ? (
        <section className="advanced-results" aria-label="筛选结果">
          <div className="results-summary"><p role="status">找到 {formatNumber(response.total)} 首作品</p></div>
          {response.items.length ? (
            <>
              <div className="poem-grid">
                {response.items.map((poem) => <PoemCard key={poem.id} poem={poem} query={values.query} />)}
              </div>
              <Pagination page={response.page} pageCount={response.pageCount} hrefForPage={resultHref} />
            </>
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
