"use client";

import Form from "next/form";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useFilterNavigation } from "@/components/filter-navigation";
import { formatNumber } from "@/lib/format";
import { displayLineType } from "@/lib/format-combinations";
import { getPopoverLayout } from "@/lib/popover-layout";
import { normalizeSearchText } from "@/lib/search-normalization";
import { filterHref, readSearchFilters, validateSearchFilters, type AdvancedSearchValues, type FilterPage } from "@/lib/search-filters";
import type { Corpus, CorpusStats, InsightDatum } from "@/lib/types";

interface FilterFormState {
  sourceHref: string;
  draft: AdvancedSearchValues;
  pendingHrefs: string[];
}

export function AdvancedSearchForm({
  corpora,
  corpus,
  stats,
  authors,
  lineTypes,
  sentenceCounts,
  values,
  action = "/corpora",
}: {
  corpora: Corpus[];
  corpus: Corpus;
  stats: CorpusStats | null;
  authors: InsightDatum[];
  lineTypes: InsightDatum[];
  sentenceCounts: InsightDatum[];
  values: AdvancedSearchValues;
  action?: FilterPage;
}) {
  const router = useRouter();
  const { setDraft } = useFilterNavigation();
  const [changingCorpus, startCorpusTransition] = useTransition();
  const appliedValues = readSearchFilters(useSearchParams()).values;
  const appliedHref = filterHref(action, corpus.key, appliedValues);
  const error = validateSearchFilters(
    appliedValues,
    lineTypes.map((item) => item.label),
    sentenceCounts.map((item) => item.label),
  );
  const [state, setState] = useState<FilterFormState>({
    sourceHref: appliedHref,
    draft: values,
    pendingHrefs: [],
  });
  // Retain newer edits across our own requests; other URL changes restore the URL's values.
  const draft = state.sourceHref === appliedHref || state.pendingHrefs.includes(appliedHref)
    ? state.draft
    : appliedValues;
  const { query, authors: selectedAuthors, lineType, sentenceCount } = draft;
  const [authorQuery, setAuthorQuery] = useState("");
  const [visibleAuthorCount, setVisibleAuthorCount] = useState(100);
  const authorPicker = useRef<HTMLDetailsElement>(null);
  const authorList = useRef<HTMLDivElement>(null);
  const pendingUpdate = useRef<ReturnType<typeof setTimeout> | null>(null);
  const composing = useRef(false);
  const cancelPending = useCallback(() => {
    if (pendingUpdate.current !== null) {
      clearTimeout(pendingUpdate.current);
      pendingUpdate.current = null;
    }
  }, []);
  const isUpdating = changingCorpus ||
    filterHref(action, corpus.key, { ...draft, query: query.trim() }) !== appliedHref;
  const authorOptions = useMemo(
    () => authors.map((author) => ({
      ...author,
      normalized: normalizeSearchText(author.label),
    })),
    [authors],
  );
  const normalizedAuthorQuery = normalizeSearchText(authorQuery.trim());
  const matchingAuthors = authorOptions.filter((author) =>
    author.normalized.includes(normalizedAuthorQuery),
  );

  useEffect(() => cancelPending, [cancelPending]);

  useEffect(() => {
    if (state.sourceHref !== appliedHref && !state.pendingHrefs.includes(appliedHref)) {
      cancelPending();
    }
  }, [appliedHref, state.sourceHref, state.pendingHrefs, cancelPending]);

  useEffect(() => {
    function restoreHistory() {
      cancelPending();
      const { values } = readSearchFilters(new URLSearchParams(window.location.search));
      setState({
        sourceHref: filterHref(action, corpus.key, values),
        draft: values,
        pendingHrefs: [],
      });
      setDraft(null);
    }
    window.addEventListener("popstate", restoreHistory);
    return () => window.removeEventListener("popstate", restoreHistory);
  }, [action, corpus.key, cancelPending, setDraft]);

  useEffect(() => () => setDraft(null), [setDraft]);

  const positionAuthorPicker = useCallback(() => {
    const picker = authorPicker.current;
    const summary = picker?.querySelector("summary");
    const content = picker?.querySelector<HTMLDivElement>(".author-picker-content");
    if (!picker?.open || !summary || !content) return;
    const viewport = window.visualViewport;
    const anchor = summary.getBoundingClientRect();
    const headerBottom = document.querySelector(".site-header")?.getBoundingClientRect().bottom ?? 0;
    const top = Math.max(viewport?.offsetTop ?? 0, headerBottom);
    const rootSize = parseFloat(getComputedStyle(document.documentElement).fontSize);
    const bounds = {
      left: viewport?.offsetLeft ?? 0,
      top,
      width: viewport?.width ?? window.innerWidth,
      height: Math.max(0, (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight) - top),
    };
    const position = getPopoverLayout(
      anchor,
      bounds,
      anchor.width,
      20 * rootSize,
    );
    content.style.position = "fixed";
    content.style.left = `${position.left}px`;
    content.style.width = `${position.width}px`;
    content.style.maxHeight = `${position.maxHeight}px`;
    const height = content.getBoundingClientRect().height;
    content.style.top = `${position.above ? position.edge - height : position.edge}px`;
  }, []);

  useEffect(() => {
    const picker = authorPicker.current;
    const summary = picker?.querySelector("summary");
    const content = picker?.querySelector<HTMLDivElement>(".author-picker-content");
    if (!picker || !summary || !content) return;
    const viewport = window.visualViewport;
    const observer = new ResizeObserver(positionAuthorPicker);
    observer.observe(summary);
    observer.observe(content);
    positionAuthorPicker();
    window.addEventListener("resize", positionAuthorPicker);
    window.addEventListener("scroll", positionAuthorPicker, { capture: true, passive: true });
    viewport?.addEventListener("resize", positionAuthorPicker);
    viewport?.addEventListener("scroll", positionAuthorPicker);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", positionAuthorPicker);
      window.removeEventListener("scroll", positionAuthorPicker, true);
      viewport?.removeEventListener("resize", positionAuthorPicker);
      viewport?.removeEventListener("scroll", positionAuthorPicker);
    };
  }, [positionAuthorPicker]);

  useEffect(() => {
    function closeAuthorPicker(event: PointerEvent) {
      if (event.target instanceof Node && !authorPicker.current?.contains(event.target)) {
        authorPicker.current?.removeAttribute("open");
      }
    }
    document.addEventListener("pointerdown", closeAuthorPicker);
    return () => document.removeEventListener("pointerdown", closeAuthorPicker);
  }, []);

  function applyFilters(next: AdvancedSearchValues) {
    cancelPending();
    const href = filterHref(action, corpus.key, { ...next, query: next.query.trim() });
    if (href === appliedHref && !state.pendingHrefs.length) return;
    setState((current) => ({
      ...current,
      sourceHref: appliedHref,
      pendingHrefs: [...current.pendingHrefs.filter((pending) => pending !== href), href],
    }));
    router.push(href, { scroll: false });
  }

  function changeFilters(patch: Partial<AdvancedSearchValues>, debounce = false) {
    const next = { ...draft, ...patch };
    setState((current) => {
      const completed = current.pendingHrefs.indexOf(appliedHref);
      return {
        sourceHref: appliedHref,
        draft: next,
        pendingHrefs: completed >= 0 ? current.pendingHrefs.slice(completed + 1) : current.pendingHrefs,
      };
    });
    setDraft({ path: action, corpus: corpus.key, values: next, cancelPending });
    cancelPending();
    if (composing.current) return;
    if (debounce) {
      pendingUpdate.current = setTimeout(() => applyFilters(next), 400);
    } else {
      applyFilters(next);
    }
  }

  function changeCorpus(key: string) {
    cancelPending();
    setDraft({
      path: action,
      corpus: key,
      values: { query: query.trim(), authors: [], lineType: "", sentenceCount: "" },
      cancelPending,
    });
    setAuthorQuery("");
    setVisibleAuthorCount(100);
    authorPicker.current?.removeAttribute("open");
    const parameters = new URLSearchParams({ corpus: key });
    if (query.trim()) {
      parameters.set("q", query.trim());
    }
    startCorpusTransition(() => {
      router.push(`${action}?${parameters.toString()}`, { scroll: false });
    });
  }

  function toggleAuthor(author: string) {
    changeFilters({
      authors: selectedAuthors.includes(author)
        ? selectedAuthors.filter((value) => value !== author)
        : [...selectedAuthors, author],
    });
  }

  function resetFilters() {
    cancelPending();
    setDraft(null);
    setState((current) => ({
      ...current,
      sourceHref: appliedHref,
      draft: { query: "", authors: [], lineType: "", sentenceCount: "" },
      pendingHrefs: [],
    }));
    setAuthorQuery("");
    setVisibleAuthorCount(100);
    authorPicker.current?.removeAttribute("open");
    if (authorList.current) authorList.current.scrollTop = 0;
  }

  return (
    <Form
      action={action}
      prefetch={false}
      scroll={false}
      className="advanced-search-form"
      role="search"
      onSubmit={(event) => {
        event.preventDefault();
        if (!composing.current) applyFilters(draft);
      }}
      onKeyDown={(event) => {
        if (
          // Safari can report an IME confirmation as Enter with keyCode 229.
          event.key === "Enter" && !composing.current &&
          !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229 &&
          event.target instanceof HTMLInputElement &&
          event.target.name === "q"
        ) {
          event.preventDefault();
          applyFilters(draft);
          if (window.matchMedia("(pointer: coarse)").matches) event.target.blur();
        }
      }}
    >
      <fieldset disabled={changingCorpus} aria-busy={isUpdating}>
        <legend className="sr-only">高级搜索条件</legend>
        <div className="advanced-corpus-row">
          <fieldset className="advanced-corpus-options">
            <legend>文库</legend>
            <div className="corpus-pills">
              {corpora.map((item) => (
                <label className="corpus-option" key={item.key}>
                  <input
                    className="sr-only"
                    name="corpus"
                    type="radio"
                    value={item.key}
                    checked={corpus.key === item.key}
                    onChange={() => changeCorpus(item.key)}
                  />
                  <span className={`filter-link${corpus.key === item.key ? " filter-link-active" : ""}`}>
                    {item.name}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <dl className="corpus-summary" aria-label="当前筛选统计">
            <div><dt>作品</dt><dd>{stats ? formatNumber(stats.poemCount) : "--"}</dd></div>
            <div><dt>作者</dt><dd>{stats ? formatNumber(stats.authorCount) : "--"}</dd></div>
            <div><dt>正文汉字</dt><dd>{stats ? formatNumber(stats.characterCount) : "--"}</dd></div>
            <div><dt>句数</dt><dd>{stats ? formatNumber(stats.sentenceCount) : "--"}</dd></div>
          </dl>
        </div>

        <div className="advanced-fields">
          <div className="advanced-field">
            <span>作者</span>
            <details
              className="author-picker"
              ref={authorPicker}
              onToggle={positionAuthorPicker}
              onBlur={(event) => {
                // Label clicks briefly blur to the document before focusing their checkbox.
                if (event.relatedTarget instanceof Node && !event.currentTarget.contains(event.relatedTarget)) {
                  event.currentTarget.removeAttribute("open");
                }
              }}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  event.preventDefault();
                  event.currentTarget.removeAttribute("open");
                  event.currentTarget.querySelector("summary")?.focus();
                }
              }}
            >
              <summary>{selectedAuthors.length ? `已选 ${selectedAuthors.length} 位作者` : "全部作者"}</summary>
              <div className="author-picker-content">
                <label className="sr-only" htmlFor="author-query">查找作者</label>
                <input
                  id="author-query"
                  type="search"
                  autoComplete="off"
                  enterKeyHint="done"
                  placeholder="搜索作者"
                  value={authorQuery}
                  onChange={(event) => {
                    setAuthorQuery(event.target.value);
                    setVisibleAuthorCount(100);
                    if (authorList.current) authorList.current.scrollTop = 0;
                  }}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.nativeEvent.isComposing && event.nativeEvent.keyCode !== 229) {
                      event.preventDefault();
                      if (window.matchMedia("(pointer: coarse)").matches) event.currentTarget.blur();
                    }
                  }}
                />
                <div
                  className="author-options"
                  ref={authorList}
                  onScroll={(event) => {
                    const { scrollTop, scrollHeight, clientHeight } = event.currentTarget;
                    if (scrollHeight - scrollTop - clientHeight < 80) {
                      setVisibleAuthorCount((count) => Math.min(count + 100, matchingAuthors.length));
                    }
                  }}
                >
                  {matchingAuthors.slice(0, visibleAuthorCount).map((author) => (
                    <label key={author.label}>
                      <input
                        type="checkbox"
                        checked={selectedAuthors.includes(author.label)}
                        onChange={() => toggleAuthor(author.label)}
                      />
                      <span>{author.label}</span>
                      <small>{isUpdating || error ? "--" : `${formatNumber(author.value)} 首`}</small>
                    </label>
                  ))}
                  {matchingAuthors.length > visibleAuthorCount ? (
                    <button
                      className="author-load-more"
                      type="button"
                      onClick={() => setVisibleAuthorCount((count) => count + 100)}
                    >
                      更多作者
                    </button>
                  ) : null}
                </div>
                {!matchingAuthors.length ? <p>没有匹配的作者</p> : null}
              </div>
            </details>
            {selectedAuthors.map((author) => <input key={author} type="hidden" name="author" value={author} />)}
          </div>
          <label className="advanced-field">
            <span>句式</span>
            <select
              name="lineType"
              value={lineType}
              onChange={(event) => changeFilters({ lineType: event.target.value })}
            >
              <option value="">不限</option>
              {lineTypes.map((item) => <option key={item.label} value={item.label}>{displayLineType(item.label)}</option>)}
            </select>
          </label>
          <label className="advanced-field">
            <span>句数</span>
            <select
              name="sentenceCount"
              value={sentenceCount}
              onChange={(event) => changeFilters({ sentenceCount: event.target.value })}
            >
              <option value="">不限</option>
              {sentenceCounts.map((item) => (
                <option key={item.label} value={item.label}>{item.label} 句</option>
              ))}
            </select>
          </label>
          <label className="advanced-field advanced-keyword">
            <span>检索</span>
            <input
              name="q"
              type="search"
              autoComplete="off"
              enterKeyHint="search"
              placeholder="字、词、句、题、名"
              maxLength={80}
              value={query}
              onChange={(event) => changeFilters({ query: event.target.value }, true)}
              onCompositionStart={() => {
                composing.current = true;
                cancelPending();
              }}
              onCompositionEnd={(event) => {
                composing.current = false;
                changeFilters({ query: event.currentTarget.value }, true);
              }}
            />
          </label>
        </div>
        {selectedAuthors.length ? (
          <div className="selected-authors" aria-label="已选作者">
            {selectedAuthors.map((author) => (
              <button
                type="button"
                key={author}
                onClick={() => toggleAuthor(author)}
                aria-label={`移除作者${author}`}
              >
                {author} <span aria-hidden>×</span>
              </button>
            ))}
            <button type="button" onClick={() => changeFilters({ authors: [] })}>清空作者</button>
          </div>
        ) : null}
        {error ? <p className="form-error" role="alert">{error}</p> : null}
        <div className="advanced-actions">
          <Link href={`${action}?corpus=${corpus.key}`} prefetch={false} scroll={false} onNavigate={resetFilters}>
            重置筛选
          </Link>
          {isUpdating ? <span className="filter-updating" role="status">更新中…</span> : null}
          <Link
            href={filterHref(action === "/corpora" ? "/insights" : "/corpora", corpus.key, draft)}
            prefetch={false}
            onNavigate={cancelPending}
          >
            {action === "/corpora" ? "查看统计分析 →" : "查看作品 →"}
          </Link>
        </div>
      </fieldset>
    </Form>
  );
}
