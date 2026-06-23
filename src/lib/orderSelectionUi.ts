import type { CatalogPricing } from "@/lib/orderSessionTypes";
import {
  formatShapeLabel,
  orderProductLineLabel as buildOrderProductLineLabel,
  type SizeUnit,
} from "@/lib/magnetSize";

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

export function shapeLabel(
  shape: {
    shapeType: string;
    widthMm: number;
    heightMm: number;
  },
  unit?: SizeUnit,
): string {
  return formatShapeLabel(shape, unit);
}

export function orderProductLineLabel(
  shape: { shapeType: string; widthMm: number; heightMm: number },
  quantity: number,
  unit?: SizeUnit,
): string {
  return buildOrderProductLineLabel(shape, quantity, unit);
}
