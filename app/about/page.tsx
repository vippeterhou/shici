import type { Metadata } from "next";
import { getReleaseVersion } from "@/lib/data";

export const metadata: Metadata = {
  title: "关于",
  description: "了解诗笺的数据来源、搜索方法和统计边界。",
};

export default function AboutPage() {
  const release = getReleaseVersion();
  return (
    <>
      <header className="page-shell page-hero">
        <p className="eyebrow">关于诗笺</p>
        <h1>数据有出处，统计有边界</h1>
        <p>
          诗笺是一种面向阅读与探索的古诗词界面。内容与产品代码分离维护，让每次数据更新都可以验证和追溯。
        </p>
      </header>
      <article className="page-shell prose">
        <h2>数据来源</h2>
        <p>
          当前使用{" "}
          <a
            href={`https://github.com/vippeterhou/shici-data/releases/tag/${release}`}
            rel="noreferrer"
            target="_blank"
          >
            shici-data {release}
          </a>
          。应用在构建时下载固定版本的发布文件，校验 SHA-256
          后生成只读索引。线上请求不会临时下载整套数据。
        </p>

        <h2>搜索如何工作</h2>
        <p>
          题目、作者、词牌、分类与正文会进入本地全文索引。繁体内容与简体查询在索引时统一归一，
          因此“黃河”与“黄河”可以互相匹配。多个以空格分隔的词需要同时出现。
        </p>

        <h2>统计如何理解</h2>
        <p>
          句数与句长来自数据源的结构化字段，段落数组只用于保持原始展示分段。
          不同文库的收录标准并不完全一致，因此洞察页按文库展示，不把所有数字直接比较成文学结论。
        </p>

        <h2>项目原则</h2>
        <ul>
          <li>原文优先：不为了统一界面而改写诗词文本。</li>
          <li>范围明确：搜索范围、文库范围与统计口径始终可见。</li>
          <li>渐进呈现：先服务寻找与阅读，再在需要时展示复杂数据。</li>
          <li>可验证：发布版本、校验值与索引构建过程可以复现。</li>
        </ul>
      </article>
    </>
  );
}
