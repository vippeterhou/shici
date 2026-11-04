import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { PoemCard } from "./poem-card";

vi.mock("next/link", () => ({
  default: ({
    children,
    ...props
  }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a {...props}>{children}</a>
  ),
}));

describe("PoemCard search highlighting", () => {
  it("highlights every visible match and prioritizes matching tags", () => {
    const html = renderToStaticMarkup(
      <PoemCard
        query="李白 明月 山水"
        poem={{
          id: "qts:test",
          corpus: "qts",
          corpusName: "全唐诗",
          title: "明月歌",
          author: "李白",
          excerpt: "明月照山水，明月又东升。",
          tags: ["其他一", "其他二", "山水"],
          sentenceCount: 2,
          characterCount: 12,
        }}
      />,
    );

    expect(html).toContain("<h2><mark>明月</mark>歌</h2>");
    expect(html).toContain('class="poem-card-author"><mark>李白</mark>');
    expect(html).toContain('class="tag"><mark>山水</mark></span>');
    expect(html).not.toContain("其他二");
    expect(html.match(/<mark>明月<\/mark>/g)).toHaveLength(3);
  });

  it("does not highlight fields that did not match", () => {
    const html = renderToStaticMarkup(
      <PoemCard
        query="明月"
        poem={{
          id: "qts:test",
          corpus: "qts",
          corpusName: "全唐诗",
          title: "静夜思",
          author: "李白",
          excerpt: "床前明月光。",
          tags: [],
          sentenceCount: 4,
          characterCount: 20,
        }}
      />,
    );

    expect(html).toContain("<h2>静夜思</h2>");
    expect(html).toContain('class="poem-card-author">李白</span>');
    expect(html).toContain("床前<mark>明月</mark>光。");
  });
});
