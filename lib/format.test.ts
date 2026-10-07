import { describe, expect, it } from "vitest";
import { decodeRouteSegment, poemHref } from "@/lib/format";

describe("poem routes", () => {
  it("round-trips corpus-prefixed poem identifiers", () => {
    const href = poemHref("ts300", "ts300:d9a34b5dbb3758c8");
    const encodedId = href.split("/").at(-1)!;

    expect(href).toBe("/poems/ts300/ts300%3Ad9a34b5dbb3758c8");
    expect(decodeRouteSegment(encodedId)).toBe("ts300:d9a34b5dbb3758c8");
  });

  it("keeps malformed route segments available for a normal not-found lookup", () => {
    expect(decodeRouteSegment("%")).toBe("%");
  });
});
