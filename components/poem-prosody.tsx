"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import {
  rhymeLabels,
  toneLabel,
  type PoemProsody,
  type ProsodyBook,
  type ProsodyToken,
} from "@/lib/prosody";

const storageKey = "shici-prosody-enabled";
const changeEvent = "shici-prosody-change";
const bookStorageKey = "shici-prosody-book";
const bookChangeEvent = "shici-prosody-book-change";

function createStorageSubscription(changeEventName: string) {
  return (onChange: () => void) => {
    window.addEventListener(changeEventName, onChange);
    window.addEventListener("storage", onChange);
    return () => {
      window.removeEventListener(changeEventName, onChange);
      window.removeEventListener("storage", onChange);
    };
  };
}

const subscribe = createStorageSubscription(changeEvent);
const subscribeBook = createStorageSubscription(bookChangeEvent);

function useProsodyEnabled() {
  return useSyncExternalStore(
    subscribe,
    () => window.localStorage.getItem(storageKey) === "true",
    () => false,
  );
}

function useProsodyBook(books: ProsodyBook[]): ProsodyBook | null {
  const defaultKey = books[0]?.key ?? "";
  const selectedKey = useSyncExternalStore(
    subscribeBook,
    () => {
      const stored = window.localStorage.getItem(bookStorageKey);
      return books.some((book) => book.key === stored) ? stored! : defaultKey;
    },
    () => defaultKey,
  );
  return books.find((book) => book.key === selectedKey) ?? books[0] ?? null;
}

export function ProsodyControls({
  analysis,
  placement,
}: {
  analysis: PoemProsody;
  placement: "desktop" | "mobile";
}) {
  const enabled = useProsodyEnabled();
  const descriptionId = useId();
  const available = analysis.status === "ready";
  const books = available ? analysis.books : [];
  const activeBook = useProsodyBook(books);
  return (
    <section
      className={`prosody-controls prosody-controls-${placement}`}
      aria-label="声韵分析"
    >
      <label className="prosody-switch">
        <span>声韵分析</span>
        <input
          type="checkbox"
          role="switch"
          aria-describedby={available ? undefined : descriptionId}
          checked={available && enabled}
          disabled={!available}
          onChange={(event) => {
            window.localStorage.setItem(storageKey, String(event.target.checked));
            window.dispatchEvent(new Event(changeEvent));
          }}
        />
      </label>
      {books.length > 1 && activeBook ? (
        <div className="prosody-book-picker" data-disabled={!enabled}>
          <span className="prosody-book-label">韵书</span>
          <label className="prosody-book-toggle">
            <span data-active={activeBook.key === books[0].key}>{books[0].label}</span>
            <input
              type="checkbox"
              role="switch"
              aria-label="切换韵书"
              checked={activeBook.key === books[1].key}
              disabled={!enabled}
              onChange={(event) => {
                const book = books[event.target.checked ? 1 : 0];
                window.localStorage.setItem(bookStorageKey, book.key);
                window.dispatchEvent(new Event(bookChangeEvent));
              }}
            />
            <span data-active={activeBook.key === books[1].key}>{books[1].label}</span>
          </label>
        </div>
      ) : null}
      {analysis.status === "unavailable" ? (
        <p id={descriptionId}>{analysis.message}</p>
      ) : null}
    </section>
  );
}

export function PoemBody({
  paragraphs,
  analysis,
}: {
  paragraphs: string[];
  analysis: PoemProsody | null;
}) {
  const enabled = useProsodyEnabled();
  const books = analysis?.status === "ready" ? analysis.books : [];
  const activeBook = useProsodyBook(books);
  const [selected, setSelected] = useState<{
    token: ProsodyToken;
    book: ProsodyBook;
  } | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const annotated = enabled && activeBook !== null;

  useEffect(() => {
    if (selected && annotated) {
      dialog.current?.showModal();
    }
  }, [selected, annotated]);

  if (!annotated) {
    return (
      <div className="reader-body">
        {paragraphs.map((paragraph, index) => <p key={index}>{paragraph}</p>)}
      </div>
    );
  }

  const couplets = Array.from(
    { length: Math.ceil(activeBook.lines.length / 2) },
    (_, index) => activeBook.lines.slice(index * 2, index * 2 + 2),
  );

  return (
    <>
      <div className="reader-body reader-body-prosody">
        <div className="prosody-lines">
          {couplets.map((couplet, coupletIndex) => (
            <div className="prosody-couplet" key={coupletIndex}>
              {couplet.map((line, lineIndex) => {
                const endingIndex = line.tokens.findLastIndex((token) => token.readings !== null);
                const ending = line.tokens[endingIndex];
                const rhymes = rhymeLabels(ending.readings!);
                return (
                  <div className="prosody-line" key={coupletIndex * 2 + lineIndex}>
                    <div className="prosody-line-text" aria-label={line.text}>
                      {line.tokens.map((token, tokenIndex) => {
                        if (token.readings === null) {
                          return (
                            <span className="prosody-punctuation" aria-hidden key={tokenIndex}>
                              {token.character}
                            </span>
                          );
                        }
                        const tone = toneLabel(token.readings);
                        const character = (
                          <button
                            type="button"
                            className={`prosody-character${tone === "平/仄" || tone === "?" ? " prosody-uncertain" : ""}`}
                            key={tokenIndex}
                            aria-label={`${token.character}：${tone === "?" ? "未匹配" : tone}，查看声韵候选`}
                            aria-haspopup="dialog"
                            onClick={() => setSelected({ token, book: activeBook })}
                          >
                            <span className="prosody-tone" data-tone={tone}>{tone}</span>
                            <span className="prosody-glyph">{token.character}</span>
                          </button>
                        );
                        if (tokenIndex !== endingIndex) {
                          return character;
                        }
                        return (
                          <span className="prosody-ending" key={tokenIndex}>
                            {character}
                            <button
                              type="button"
                              className="prosody-rhyme"
                              aria-label={`句末字${ending.character}：${rhymes.join("、")}，查看声韵候选`}
                              aria-haspopup="dialog"
                              onClick={() => setSelected({ token: ending, book: activeBook })}
                            >
                              {rhymes.map((rhyme) => <span key={rhyme}>{rhyme}</span>)}
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <dialog
        ref={dialog}
        className="prosody-dialog"
        aria-labelledby={headingId}
        onClose={() => setSelected(null)}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            const bounds = event.currentTarget.getBoundingClientRect();
            if (
              event.clientX < bounds.left || event.clientX > bounds.right ||
              event.clientY < bounds.top || event.clientY > bounds.bottom
            ) {
              event.currentTarget.close();
            }
          }
        }}
      >
        <header className="prosody-dialog-header">
          <h2 id={headingId}>
            {selected?.token.character} · {selected?.book.label}候选
          </h2>
          <button type="button" className="prosody-close" onClick={() => dialog.current?.close()}>
            关闭
          </button>
        </header>
        {selected ? <ReadingDetails token={selected.token} book={selected.book} /> : null}
      </dialog>
    </>
  );
}

export function ReadingDetails({
  token,
  book,
}: {
  token: ProsodyToken;
  book: ProsodyBook;
}) {
  const readings = token.readings ?? [];
  const direct = readings.filter((reading) => reading.headword === token.character);
  const variants = readings.filter((reading) => reading.headword !== token.character);
  const uncertain = new Set(readings.map(({ tone, rhyme }) => `${tone}:${rhyme}`)).size > 1;
  if (!readings.length) {
    return <p>尚未匹配到「{token.character}」的《{book.label}》记录，含字形映射查询；不使用普通话声调代替。</p>;
  }
  return (
    <>
      {uncertain ? <p className="prosody-detail-note">存在多个声韵候选，分别列出如下。</p> : null}
      {direct.length ? (
        <section className="prosody-reading-group">
          <h3>原字「{token.character}」的记录</h3>
          <ul>
            {direct.map((reading) => (
              <li key={`${reading.tone}-${reading.displayRhyme}-${reading.supplementKind ?? ""}`}>
                {reading.tone}声 · {reading.displayRhyme}
                {reading.supplementKind ? `（${reading.supplementKind}补字）` : ""}
                <span>（{reading.tone === "平" ? "平" : "仄"}）</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {variants.length ? (
        <section className="prosody-reading-group">
          <h3>字形映射候选</h3>
          <ul>
            {variants.map((reading) => (
              <li key={`${reading.headword}-${reading.tone}-${reading.displayRhyme}-${reading.supplementKind ?? ""}`}>
                据「{reading.headword}」查得：{reading.tone}声 · {reading.displayRhyme}
                {reading.supplementKind ? `（${reading.supplementKind}补字）` : ""}
                <span>（{reading.tone === "平" ? "平" : "仄"}）</span>
              </li>
            ))}
          </ul>
          <p>这些是映射字形的韵书记录，不代表每条读音都适用于此处的「{token.character}」。</p>
        </section>
      ) : null}
      <p className="prosody-detail-note">以上为字典候选，未经本诗语境校订；不依据格律自动选读音。</p>
    </>
  );
}
