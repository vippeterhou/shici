interface AnchorBounds {
  left: number;
  top: number;
  bottom: number;
}

interface ViewportBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function getPopoverLayout(
  anchor: AnchorBounds,
  viewport: ViewportBounds,
  preferredWidth: number,
  preferredHeight: number,
) {
  const inset = 8;
  const gap = 6;
  const leftEdge = viewport.left + inset;
  const rightEdge = viewport.left + viewport.width - inset;
  const topEdge = viewport.top + inset;
  const bottomEdge = viewport.top + viewport.height - inset;
  const belowTop = Math.max(topEdge, anchor.bottom + gap);
  const aboveBottom = Math.min(bottomEdge, anchor.top - gap);
  const spaceBelow = Math.max(0, bottomEdge - belowTop);
  const spaceAbove = Math.max(0, aboveBottom - topEdge);
  const above = spaceBelow < preferredHeight && spaceAbove > spaceBelow;
  const width = Math.min(preferredWidth, Math.max(0, rightEdge - leftEdge));

  return {
    left: Math.max(leftEdge, Math.min(anchor.left, rightEdge - width)),
    width,
    maxHeight: Math.min(preferredHeight, above ? spaceAbove : spaceBelow),
    above,
    edge: above ? aboveBottom : belowTop,
  };
}
