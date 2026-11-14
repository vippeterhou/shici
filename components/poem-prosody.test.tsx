import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PoemBody, ProsodyControls, ReadingDetails } from "./poem-prosody";
import type { ProsodyBook } from "@/lib/prosody";

const guangyun: ProsodyBook = {
  key: "guangyun",
  label: "广韵",
  lines: [],
};
const pingshuiyun: ProsodyBook = {
  key: "pingshuiyun",
  label: "平水韵",
  lines: [],
};

describe("prosody reader", () => {
  it("preserves ordinary reading before the switch is enabled", () => {
    const html = renderToStaticMarkup(
      <PoemBody
        paragraphs={["牀前明月光，", "疑是地上霜。"]}
        lines={null}
        analysis={null}
      />,
    );
    expect(html).toContain("<p>牀前明月光，</p><p>疑是地上霜。</p>");
    expect(html).not.toContain("prosody-character");
  });

  it("uses structural lines for the default couplet layout", () => {
    const html = renderToStaticMarkup(
      <PoemBody
        paragraphs={["一一一一一，二二二二二。三三三三三，四四四四四。"]}
        lines={["一一一一一，", "二二二二二。", "三三三三三，", "四四四四四。"]}
        analysis={null}
      />,
    );
    expect(html.match(/prosody-plain-couplet/g)).toHaveLength(2);
    expect(html).toContain("一一一一一，二二二二二。");
  });

  it("distinguishes original polyphony from variant-search candidates", () => {
    const html = renderToStaticMarkup(
      <ReadingDetails token={{
        character: "瀟",
        readings: [
          {
            headword: "瀟", tone: "平", rhyme: "蕭",
            compactRhyme: "蕭韵", displayRhyme: "蕭韵",
          },
          {
            headword: "潚", tone: "平", rhyme: "蕭",
            compactRhyme: "蕭韵", displayRhyme: "蕭韵",
          },
          {
            headword: "潚", tone: "入", rhyme: "屋",
            compactRhyme: "屋韵", displayRhyme: "屋韵",
          },
        ],
      }} book={guangyun} />,
    );
    expect(html).toContain("原字「瀟」的记录");
    expect(html).toContain("字形映射候选");
    expect(html).toContain("据「潚」查得：入声 · 屋韵");
    expect(html).toContain("存在多个声韵候选");
    expect(html).not.toContain("待定");
    expect(html).toContain("不代表每条读音都适用于此处的「瀟」");
  });

  it("explains unmatched characters without a modern-tone fallback", () => {
    const html = renderToStaticMarkup(
      <ReadingDetails token={{ character: "蝴", readings: [] }} book={guangyun} />,
    );
    expect(html).toContain("尚未匹配到「蝴」");
    expect(html).toContain("不使用普通话声调代替");
  });

  it("offers both rhyme books and identifies Pingshui supplemental entries", () => {
    const controls = renderToStaticMarkup(
      <ProsodyControls
        analysis={{ status: "ready", books: [guangyun, pingshuiyun] }}
        placement="desktop"
      />,
    );
    expect(controls).toContain('aria-label="切换韵书"');
    expect(controls).toContain('data-active="true">广韵</span>');
    expect(controls).toContain('data-active="false">平水韵</span>');
    expect(controls).toContain('data-disabled="true"');
    expect(controls).not.toContain("平仄、韵部皆依");

    const details = renderToStaticMarkup(
      <ReadingDetails
        token={{
          character: "霜",
          readings: [{
            headword: "霜",
            tone: "平",
            rhyme: "陽",
            compactRhyme: "陽韵",
            displayRhyme: "下平七陽",
            supplementKind: "詞",
          }],
        }}
        book={pingshuiyun}
      />,
    );
    expect(details).toContain("平声 · 下平七陽（詞补字）");
  });

  it("disables the switch with an explicit explanation if data is unavailable", () => {
    const html = renderToStaticMarkup(
      <ProsodyControls
        analysis={{ status: "unavailable", message: "当前数据版本未包含广韵字典。" }}
        placement="desktop"
      />,
    );
    expect(html).toContain('role="switch"');
    expect(html).toContain('disabled=""');
    expect(html).toContain("当前数据版本未包含广韵字典。");
  });
});
