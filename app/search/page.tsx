import type { Metadata } from "next";
import Link from "next/link";
import { Pagination } from "@/components/pagination";
import { PoemCard } from "@/components/poem-card";
import { SearchForm } from "@/components/search-form";
import { getCorpora, searchPoems } from "@/lib/data";
import { formatNumber } from "@/lib/format";

export const metadata: Metadata = {
  title: "全库搜索",
  description: "跨文库搜索中国古典诗词，支持简体与繁体输入。",
};

interface SearchPageProps {
  searchParams: Promise<{
    q?: string;
    corpus?: string;
    page?: string;
  }>;
}

export default async function SearchPage({ searchParams }: SearchPageProps) {
  const parameters = await searchParams;
  const query = parameters.q?.trim() ?? "";
  const selectedCorpus = parameters.corpus ?? "";
  const page = Number.parseInt(parameters.page ?? "1", 10);
  const corpora = getCorpora();
  const response = query
    ? searchPoems(query, {
        corpus: selectedCorpus || undefined,
        page,
      })
    : null;
  const selectedCorpusName = corpora.find(
    (corpus) => corpus.key === selectedCorpus,
  )?.name;

  function resultHref(corpus: string, nextPage = 1) {
    const values = new URLSearchParams({ q: query });
    if (corpus) {
      values.set("corpus", corpus);
    }
    if (nextPage > 1) {
      values.set("page", String(nextPage));
    }
    return `/search?${values.toString()}`;
  }

  return (
    <>
      <header className="page-shell page-hero">
        <p className="eyebrow">全库搜索</p>
        <h1>{query ? `寻找“${query}”` : "从一句诗开始"}</h1>
        <p>
          搜索题目、作者、词牌、分类和正文。繁体与简体输入会自动归一匹配。
        </p>
        <div className="page-search">
          <SearchForm defaultValue={query} autoFocus={!query} />
        </div>
      </header>

      <section className="page-shell section">
        {!query ? (
          <div className="empty-state">
            <h2>输入想找的名字或字句</h2>
            <p>例如：李白、明月、黄河入海、蝶恋花。</p>
          </div>
        ) : response && response.items.length ? (
          <div className="search-layout">
            <aside className="search-filters" aria-label="按文库筛选">
              <h2>文库</h2>
              <Link
                className={`filter-link${!selectedCorpus ? " filter-link-active" : ""}`}
                href={resultHref("")}
              >
                <span>全部文库</span>
              </Link>
              {corpora.map((corpus) => (
                <Link
                  className={`filter-link${
                    corpus.key === selectedCorpus ? " filter-link-active" : ""
                  }`}
                  href={resultHref(corpus.key)}
                  key={corpus.key}
                >
                  <span>{corpus.name}</span>
                </Link>
              ))}
            </aside>
            <div>
              <div className="results-summary">
                <p>
                  {selectedCorpusName ? `${selectedCorpusName}中` : ""}
                  找到 {formatNumber(response.total)} 首作品
                </p>
              </div>
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
                hrefForPage={(nextPage) =>
                  resultHref(selectedCorpus, nextPage)
                }
              />
            </div>
          </div>
        ) : (
          <div className="empty-state">
            <h2>没有找到相符的作品</h2>
            <p>试试更短的字句、作者姓名，或移除文库范围。</p>
          </div>
        )}
      </section>
    </>
  );
}
