# 诗笺

诗笺是一个面向发现、阅读与探索的中国古诗词网站，收录从《诗经》到唐宋的
八个文库、三十二万余首作品。

## 产品结构

- **发现**：全库搜索入口、每日一首与文库导览
- **搜索**：跨题目、作者、词牌、分类与正文的简繁体归一搜索
- **文库**：在明确的数据范围内浏览作品与进入文库搜索
- **阅读**：拥有稳定 URL、结构信息与相邻作品导航的专注阅读页
- **数据洞察**：按文库查看作者、句数、句式与正文高频字
- **关于**：公开数据版本、搜索方法与统计边界

## 架构

应用是一个 Next.js 服务，部署时由 Docker 构建：

1. 读取本仓库固定的 `data_release.json`。
2. 从独立的
   [`vippeterhou/shici-data`](https://github.com/vippeterhou/shici-data)
   GitHub Release 下载压缩 JSONL。
3. 验证每个资源的 SHA-256 与作品数量。
4. 生成只读 SQLite 数据库、中文短语全文索引与预计算统计。
5. 将数据库和 Next.js standalone 服务一起放入生产镜像。

线上请求不会下载或重建数据。Next.js 直接查询同一容器中的只读 SQLite，
因此搜索不需要外部数据库或跨服务网络请求。

## 本地开发

需要 Node.js 22 或更新版本。

```bash
pnpm install
pnpm run build:data
pnpm run dev
```

打开 <http://localhost:3000>。

首次 `build:data` 会下载约 45 MB 压缩数据并生成本地数据库。下载文件会复用；
只要数据清单和索引版本未变化，后续执行会直接使用现有数据库。

### 预览本地数据仓库

先在相邻的 `shici-data` 仓库生成发布资源：

```bash
cd ../shici-data
python3 scripts/build_release.py --version local

cd ../shici
SHICI_DATA_MANIFEST=../shici-data/dist/manifest.json \
SHICI_DATA_ASSET_DIRECTORY=../shici-data/dist \
  pnpm run build:data
```

环境变量只影响本地构建，不会修改生产固定的 `data_release.json`。

## 验证

```bash
pnpm test
pnpm run typecheck
pnpm run lint
pnpm run build
```

健康检查：

```bash
curl http://localhost:3000/api/health
```

## Render 部署

仓库根目录的 `render.yaml` 与 `Dockerfile` 定义一个免费 Web Service：

- Docker 构建阶段获取并验证固定的数据发布版本
- `/api/health` 只在数据库可以读取时返回 `200`
- 服务监听 Render 提供的 `PORT`（镜像默认使用 `10000`）
- 免费实例休眠后无需重新索引，因为数据库已经包含在镜像中

在 Render 创建 Blueprint 并连接此仓库即可。生产域名配置为
`NEXT_PUBLIC_SITE_URL`，以生成正确的 canonical、Open Graph、robots 与 sitemap
地址。

## 数据更新

数据与产品代码保持独立：

1. 在 `shici-data` 中修订并发布新版本。
2. 更新本仓库的 `data_release.json`。
3. 运行完整验证。
4. 部署新镜像。

旧版本的 GitHub Release 保持不可变，因此任何生产镜像都可以复现。
