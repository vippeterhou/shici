"use client";

import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export function RhymeCharacters({
  label,
  defaultExpanded,
  children,
}: {
  label: string;
  defaultExpanded: boolean;
  children: ReactNode;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [overflowing, setOverflowing] = useState(false);
  const charactersRef = useRef<HTMLDivElement>(null);
  const contentId = useId();

  useEffect(() => {
    const characters = charactersRef.current;
    if (!characters || expanded) return;
    const observer = new ResizeObserver(() => {
      setOverflowing(characters.scrollWidth > characters.clientWidth + 1);
    });
    observer.observe(characters);
    return () => observer.disconnect();
  }, [expanded]);

  return (
    <div className={`rhyme-character-list${expanded ? " is-expanded" : ""}`}>
      <div
        className="rhyme-characters"
        id={contentId}
        ref={charactersRef}
        aria-label={`${label}字头`}
      >
        {children}
      </div>
      <button
        className="rhyme-expand"
        type="button"
        aria-expanded={expanded}
        aria-controls={contentId}
        aria-label={`${expanded ? "收起" : "展开"}${label}的全部字头`}
        title={expanded ? "收起" : "展开全部"}
        hidden={!expanded && !overflowing}
        onClick={() => setExpanded(!expanded)}
      >
        {expanded ? <ChevronUp aria-hidden /> : <ChevronDown aria-hidden />}
      </button>
    </div>
  );
}
