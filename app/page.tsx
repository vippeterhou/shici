import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { PoemCard } from "@/components/poem-card";
import { SearchForm } from "@/components/search-form";
import { getCorpora, searchPoems } from "@/lib/data";
import { formatNumber } from "@/lib/format";

interface HomePageProps {
  searchParams: Promise<{
    q?: string;
    corpus?: string;
    page?: string;
  }>;
}

export default async function HomePage({ searchParams }: HomePageProps) {
  const parameters = await searchParams;
  const query = parameters.q?.trim() ?? "";
  const selectedCorpus = parameters.corpus ?? "";
  const corpora = getCorpora();
  const response = query
    ? searchPoems(query, {
        corpus: selectedCorpus || undefined,
        page: Number.parseInt(parameters.page ?? "1", 10),
      })
    : null;
  const selectedCorpusName = corpora.find(
    (corpus) => corpus.key === selectedCorpus,
  )?.name;

  function resultHref(corpus: string, page = 1) {
    const values = new URLSearchParams({ q: query });
    if (corpus) {
      values.set("corpus", corpus);
    }
    if (page > 1) {
      values.set("page", String(page));
    }
    return `/?${values.toString()}`;
  }

  return (
    <div className={`search-page${response ? " search-page-results" : ""}`}>
      <section className="hero" aria-labelledby="home-title">
        <div className="page-shell hero-content">
          <h1 id="home-title">中国古典诗词</h1>
          <div className="hero-search">
            <SearchForm
              label="搜索诗词"
              placeholder="字、词、句、题、名"
              defaultValue={query}
              corpus={selectedCorpus || undefined}
            />
          </div>
        </div>
      </section>

      {response ? (
        <section className="page-shell search-results" aria-label="搜索结果">
          <nav className="search-filters" aria-label="按文库筛选">
            <Link
              className={`filter-link${!selectedCorpus ? " filter-link-active" : ""}`}
              href={resultHref("")}
              scroll={false}
              aria-current={!selectedCorpus ? "page" : undefined}
            >
              全部文库
            </Link>
            {corpora.map((corpus) => (
              <Link
                className={`filter-link${
                  corpus.key === selectedCorpus ? " filter-link-active" : ""
                }`}
                href={resultHref(corpus.key)}
                scroll={false}
                aria-current={corpus.key === selectedCorpus ? "page" : undefined}
                key={corpus.key}
              >
                {corpus.name}
              </Link>
            ))}
          </nav>
          <div className="results-summary">
            <p role="status">
              {selectedCorpusName ? `${selectedCorpusName}中` : ""}
              找到 {formatNumber(response.total)} 首作品
            </p>
          </div>
          {response.items.length ? (
            <>
              <div className="poem-grid">
                {response.items.map((poem) => (
                  <PoemCard
                    poem={poem}
                    showCorpus
                    query={query}
                    key={poem.id}
                  />
                ))}
              </div>
              <Pagination
                page={response.page}
                pageCount={response.pageCount}
                hrefForPage={(page) => resultHref(selectedCorpus, page)}
              />
            </>
          ) : (
            <div className="empty-state">
              <h2>没有找到相符的作品</h2>
              <p>试试更短的字句、作者姓名，或选择全部文库。</p>
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
