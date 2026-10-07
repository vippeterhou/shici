import { getCorpora, getReleaseVersion } from "@/lib/data";

export const dynamic = "force-dynamic";

export function GET() {
  try {
    const corpora = getCorpora();
    return Response.json({
      status: "ok",
      release: getReleaseVersion(),
      corpora: corpora.length,
      poems: corpora.reduce((total, corpus) => total + corpus.poemCount, 0),
    });
  } catch (error) {
    return Response.json(
      {
        status: "unavailable",
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 503 },
    );
  }
}
