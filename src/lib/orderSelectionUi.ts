import type { CatalogPricing } from "@/lib/orderSessionTypes";

/** Lowest price per magnet among bundle tiers (for default selection). */
export function bestBundleId(pricing: CatalogPricing[]): string | null {
  const bundles = pricing.filter(
    (p) => p.type === "bundle" && p.quantity != null && p.quantity > 0,
  );
  if (bundles.length === 0) return null;
  let best = bundles[0];
  let bestRatio = Number(best.price) / Number(best.quantity);
  for (let i = 1; i < bundles.length; i++) {
    const b = bundles[i];
    const r = Number(b.price) / Number(b.quantity);
    if (r < bestRatio) {
      bestRatio = r;
      best = b;
    }
  }
  return best.id;
}

export function shapeLabel(shape: {
  shapeType: string;
  widthMm: number;
  heightMm: number;
}): string {
  const t =
    shape.shapeType.charAt(0) + shape.shapeType.slice(1).toLowerCase();
  return `${t} ${shape.widthMm}×${shape.heightMm} mm`;
}

function mmToCmLabel(mm: number): string {
  const cm = mm / 10;
  return Number.isInteger(cm) ? String(cm) : cm.toFixed(1).replace(/\.0$/, "");
}

/** e.g. "5×5 cm Square Custom Photo Magnets · 12 magnets" */
export function orderProductLineLabel(
  shape: { shapeType: string; widthMm: number; heightMm: number },
  quantity: number,
): string {
  const w = mmToCmLabel(shape.widthMm);
  const h = mmToCmLabel(shape.heightMm);
  const t =
    shape.shapeType.charAt(0) + shape.shapeType.slice(1).toLowerCase();
  const size =
    w === h ? `${w}×${h} cm` : `${w}×${h} cm`;
  const magnetWord = quantity === 1 ? "magnet" : "magnets";
  return `${size} ${t} Custom Photo Magnets · ${quantity} ${magnetWord}`;
}
