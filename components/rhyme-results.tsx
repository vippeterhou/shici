"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, X } from "lucide-react";

export function RhymeResults({
  query,
  matchedLabels,
  children,
}: {
  query: string;
  matchedLabels: string[];
  children: ReactNode;
}) {
  const [activeIndex, setActiveIndex] = useState(0);
  const resultsRef = useRef<HTMLDivElement>(null);
  const navigationRef = useRef<HTMLElement>(null);
  const router = useRouter();

  const scrollToResult = useCallback((index: number, behavior: ScrollBehavior) => {
    const results = resultsRef.current;
    if (!results) return;
    const matches = results.querySelectorAll<HTMLElement>("[data-rhyme-match]");
    const target = matches[index];
    if (!target) return;
    matches.forEach((match) => match.removeAttribute("data-rhyme-current"));
    target.setAttribute("data-rhyme-current", "");
    const headerOffset = parseFloat(
      getComputedStyle(results).getPropertyValue("--rhyme-header-offset"),
    );
    const navigationHeight = navigationRef.current?.getBoundingClientRect().height ?? 0;
    window.scrollTo({
      top: Math.max(0, target.getBoundingClientRect().top + window.scrollY
        - headerOffset - navigationHeight - 12),
      behavior,
    });
  }, []);

  useEffect(() => {
    const results = resultsRef.current;
    const header = document.querySelector<HTMLElement>(".site-header");
    if (!results || !header) return;
    const updateOffset = () => {
      const offset = getComputedStyle(header).position === "sticky"
        ? header.getBoundingClientRect().height : 0;
      results.style.setProperty("--rhyme-header-offset", `${offset}px`);
    };
    updateOffset();
    const observer = new ResizeObserver(updateOffset);
    observer.observe(header);
    window.addEventListener("resize", updateOffset);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateOffset);
    };
  }, []);

  useEffect(() => {
    if (!query || !matchedLabels.length) return;
    const frame = requestAnimationFrame(() => scrollToResult(0, "instant"));
    return () => cancelAnimationFrame(frame);
  }, [query, matchedLabels.length, scrollToResult]);

  function moveResult(direction: number) {
    const nextIndex = (activeIndex + direction + matchedLabels.length) % matchedLabels.length;
    setActiveIndex(nextIndex);
    scrollToResult(nextIndex,
      window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth");
  }

  function clearSearch() {
    router.replace("/rhymes", { scroll: false });
    document.querySelector<HTMLInputElement>('.rhyme-page input[name="q"]')
      ?.focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  return (
    <div className="rhyme-results" ref={resultsRef}>
      {query && matchedLabels.length > 0 ? (
        <nav className="rhyme-result-navigation" aria-label="搜索结果导航" ref={navigationRef}>
          <p role="status">
            <span className="rhyme-result-count">{activeIndex + 1} / {matchedLabels.length}</span>
            <span className="rhyme-result-label">{matchedLabels[activeIndex]}</span>
          </p>
          <div className="rhyme-result-controls">
            {matchedLabels.length > 1 ? (
              <>
                <button type="button" aria-label="上一个结果" title="上一个结果" onClick={() => moveResult(-1)}>
                  <ArrowUp aria-hidden />
                </button>
                <button type="button" aria-label="下一个结果" title="下一个结果" onClick={() => moveResult(1)}>
                  <ArrowDown aria-hidden />
                </button>
              </>
            ) : null}
            <button type="button" aria-label="清除本次搜索" title="清除搜索" onClick={clearSearch}>
              <X aria-hidden />
            </button>
          </div>
        </nav>
      ) : null}
      {children}
    </div>
  );
}
