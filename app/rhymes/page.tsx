import type { Metadata } from "next";
import Link from "next/link";
import { SearchForm } from "@/components/search-form";
import { RhymeCharacters } from "@/components/rhyme-characters";
import { RhymeResults } from "@/components/rhyme-results";
import { getRhymeDirectory } from "@/lib/rhyme-data";
import { formatNumber } from "@/lib/format";
import type { FilterParameters } from "@/lib/search-filters";

export const metadata: Metadata = {
  title: "诗韵 · 平水韵",
  description: "按平水韵106韵浏览字头，查询汉字归韵，参看与《广韵》的对应、同用及例外说明。",
  alternates: { canonical: "/rhymes" },
};

export default async function RhymesPage({
  searchParams,
}: {
  searchParams: Promise<FilterParameters>;
}) {
  const parameters = await searchParams;
  const query = (Array.isArray(parameters.q) ? parameters.q[0] : parameters.q ?? "").trim();
  const error = query.length > 80 ? "搜索内容请勿超过80个字符。" : null;
  const directory = error ? null : getRhymeDirectory(query);
  const sections = directory?.sections.filter((section) => section.groups.length) ?? [];
  const matchedGroupIds = new Set(directory?.matchedGroupIds);
  const matchedGroups = sections.flatMap((section) => section.groups)
    .filter((group) => matchedGroupIds.has(group.id));

  return (
    <div className="page-shell advanced-page rhyme-page">
      <header className="advanced-heading rhyme-heading">
        <div className="rhyme-title">
          <h1>诗韵</h1>
          <span>平水韵</span>
        </div>
      </header>
      <SearchForm
        action="/rhymes"
        clearHref="/rhymes"
        defaultValue={query}
        label="查找汉字或韵目"
        placeholder="查字或韵目，如 风、風、閒、上平一東、十三元"
      />
      {directory ? (
        <>
          <div className="results-summary">
            <p role="status">
              {query
                ? `「${query}」找到 ${formatNumber(directory.matchedGroupCount)} 个韵部`
                : `${formatNumber(directory.groupCount)} 个韵部 · ${formatNumber(directory.characterCount)} 个字头`}
            </p>
            {!query ? (
              <p className="rhyme-legend">
                <span>以《广韵》206韵为参照，多依独用、同用关系归并，<span className="rhyme-special-key">特殊分合以颜色标注。</span>补：补充字头。</span>
              </p>
            ) : null}
          </div>
          {query && !directory.matchedGroupCount ? (
            <div className="empty-state">
              <h2>没有找到相符的字头或韵目</h2>
              <p>可继续浏览下方完整目录，或尝试「东韵」「上平」「上平一東」等韵目。未收录不代表该字不能押韵。</p>
              <Link href="/rhymes">清除搜索</Link>
            </div>
          ) : null}
          <RhymeResults key={query} query={query} matchedLabels={matchedGroups.map((group) => group.label)}>
              <div className="rhyme-directory">
                {sections.map((section) => (
                  <section key={section.id} aria-labelledby={`${section.id}-heading`}>
                    <h2 id={`${section.id}-heading`}>
                      {section.label}<span>{section.groups.length}韵</span>
                    </h2>
                    {section.groups.map((group) => (
                      <article
                        className="rhyme-row"
                        key={group.id}
                        aria-labelledby={`${group.id}-heading`}
                        data-rhyme-match={query && matchedGroupIds.has(group.id) ? "" : undefined}
                      >
                        <div className="rhyme-row-label">
                          <header className="rhyme-row-heading">
                            <h3 id={`${group.id}-heading`}>
                              {group.label}
                            </h3>
                            <span>{formatNumber(new Set(group.characters.map((entry) => entry.character)).size)} 字</span>
                          </header>
                          <p className={group.note.isSpecial ? "rhyme-note is-special" : "rhyme-note"}>
                            {group.note.description}
                          </p>
                        </div>
                        <div className="rhyme-row-content">
                          {group.matchedCharacters.some((character) => character !== query) ? (
                            <p className="rhyme-alias-note">
                              「{query}」的候选字头：{group.matchedCharacters.join("、")}。字形映射不代表所有读音均相同。
                            </p>
                          ) : null}
                          <RhymeCharacters
                            label={group.label}
                            defaultExpanded={group.matchedCharacters.length > 0}
                          >
                            {group.characters.map((entry) => (
                              <span
                                key={`${entry.character}:${entry.supplementKind}`}
                                className={group.matchedCharacters.includes(entry.character) ? "rhyme-character is-match" : "rhyme-character"}
                                title={entry.supplementKind ? `${entry.supplementKind}补字` : undefined}
                              >
                                <span>{entry.character}</span>
                                {entry.supplementKind ? <small>补</small> : null}
                              </span>
                            ))}
                          </RhymeCharacters>
                        </div>
                      </article>
                    ))}
                  </section>
                ))}
              </div>
          </RhymeResults>
        </>
      ) : (
        <div className="empty-state" role={error ? "alert" : "status"}>
          <h2>{error ? "搜索内容过长" : "平水韵数据暂不可用"}</h2>
          <p>{error ?? "当前数据版本未包含平水韵字库，请更新数据后重试。"}</p>
        </div>
      )}
    </div>
  );
}
