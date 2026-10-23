import { describe, expect, it } from "vitest";
import { getPopoverLayout } from "@/lib/popover-layout";

describe("viewport-aware popover placement", () => {
  const viewport = { left: 0, top: 128, width: 320, height: 440 };

  it("opens below the trigger when there is room", () => {
    expect(getPopoverLayout({ left: 16, top: 150, bottom: 194 }, viewport, 288, 320)).toEqual({
      left: 16, width: 288, maxHeight: 320, above: false, edge: 200,
    });
  });

  it("preserves a compact trigger width without widening the dropdown", () => {
    const position = getPopoverLayout({ left: 168, top: 150, bottom: 194 }, viewport, 136, 320);
    expect(position.left).toBe(168);
    expect(position.width).toBe(136);
  });

  it("flips above a low trigger without covering it or the sticky header", () => {
    const position = getPopoverLayout({ left: 168, top: 500, bottom: 544 }, viewport, 288, 320);
    expect(position).toEqual({ left: 24, width: 288, maxHeight: 320, above: true, edge: 494 });
    expect(position.edge - position.maxHeight).toBeGreaterThanOrEqual(viewport.top + 8);
  });

  it("shrinks to the available space above a virtual keyboard", () => {
    const position = getPopoverLayout(
      { left: 168, top: 260, bottom: 304 },
      { ...viewport, height: 224 },
      288,
      320,
    );
    expect(position).toEqual({ left: 24, width: 288, maxHeight: 118, above: true, edge: 254 });
  });

  it("keeps an enlarged picker within a panned and zoomed visual viewport", () => {
    const position = getPopoverLayout(
      { left: 300, top: 260, bottom: 304 },
      { left: 150, top: 128, width: 195, height: 300 },
      576,
      640,
    );
    expect(position.width).toBe(179);
    expect(position.left).toBe(158);
    expect(position.maxHeight).toBe(118);
  });

  it("uses the usable viewport when the trigger scrolls above it", () => {
    const position = getPopoverLayout({ left: 16, top: 20, bottom: 64 }, viewport, 288, 320);
    expect(position.edge).toBe(136);
    expect(position.above).toBe(false);
    expect(position.edge + position.maxHeight).toBeLessThanOrEqual(560);
  });
});
