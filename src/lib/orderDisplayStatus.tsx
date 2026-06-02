/**
 * Seller-facing order workflow status labels (matches Prisma OrderStatus).
 */
export type OrderWorkflowStatus =
  | "NEW"
  | "CONFIRMED"
  | "INVOICE_SENT"
  | "PAID"
  | "IN_PRODUCTION"
  | "SHIPPED"
  | "COMPLETED"
  | "CANCELLED";

export const ORDER_STATUS_LABELS: Record<OrderWorkflowStatus, string> = {
  NEW: "New",
  CONFIRMED: "Confirmed",
  INVOICE_SENT: "Invoice sent",
  PAID: "Paid",
  IN_PRODUCTION: "In production",
  SHIPPED: "Shipped",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
};

export const ORDER_STATUS_BADGE_CLASS: Record<OrderWorkflowStatus, string> = {
  NEW: "bg-blue-50 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300",
  CONFIRMED: "bg-indigo-50 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300",
  INVOICE_SENT: "bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300",
  PAID: "bg-green-50 text-green-700 dark:bg-green-950/40 dark:text-green-400",
  IN_PRODUCTION: "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300",
  SHIPPED: "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300",
  COMPLETED: "bg-surface text-muted-foreground",
  CANCELLED: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400",
};

export function orderStatusLabel(status: string): string {
  return ORDER_STATUS_LABELS[status as OrderWorkflowStatus] ?? status;
}

export function isPrintEligibleStatus(status: string): boolean {
  return (
    status === "PAID" ||
    status === "IN_PRODUCTION" ||
    status === "SHIPPED" ||
    status === "COMPLETED"
  );
}

/** Allowed next statuses for seller actions (mirrors server orderStatus.ts). */
export const ORDER_STATUS_TRANSITIONS: Record<
  OrderWorkflowStatus,
  OrderWorkflowStatus[]
> = {
  NEW: ["CONFIRMED", "CANCELLED"],
  CONFIRMED: ["INVOICE_SENT", "PAID", "CANCELLED"],
  INVOICE_SENT: ["PAID", "CANCELLED"],
  PAID: ["IN_PRODUCTION", "CANCELLED"],
  IN_PRODUCTION: ["SHIPPED"],
  SHIPPED: ["COMPLETED"],
  COMPLETED: [],
  CANCELLED: [],
};

export function nextStatusOptions(current: string): OrderWorkflowStatus[] {
  return ORDER_STATUS_TRANSITIONS[current as OrderWorkflowStatus] ?? [];
}

/** Pipeline order (matches server `ORDER_STATUSES`). */
export const ORDER_STATUSES: readonly OrderWorkflowStatus[] = [
  "NEW",
  "CONFIRMED",
  "INVOICE_SENT",
  "PAID",
  "IN_PRODUCTION",
  "SHIPPED",
  "COMPLETED",
  "CANCELLED",
] as const;

const STATUS_TO_FILTER_PARAM: Record<OrderWorkflowStatus, string> = {
  NEW: "new",
  CONFIRMED: "confirmed",
  INVOICE_SENT: "invoice_sent",
  PAID: "paid",
  IN_PRODUCTION: "in_production",
  SHIPPED: "shipped",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};

const FILTER_PARAM_TO_STATUS: Record<string, OrderWorkflowStatus> =
  Object.fromEntries(
    ORDER_STATUSES.map((s) => [STATUS_TO_FILTER_PARAM[s], s]),
  ) as Record<string, OrderWorkflowStatus>;

export type OrderStatusFilterGroupKey = "unpaid";

export const ORDER_STATUS_FILTER_GROUPS = [
  {
    value: "unpaid" as const,
    label: "Unpaid",
    statuses: ["NEW", "CONFIRMED", "INVOICE_SENT"] as const satisfies readonly OrderWorkflowStatus[],
  },
] as const;

export const UNPAID_FILTER_PARAMS = ORDER_STATUS_FILTER_GROUPS[0].statuses.map(
  (s) => STATUS_TO_FILTER_PARAM[s],
);

export const ORDER_STATUS_FILTER_OPTIONS = ORDER_STATUSES.map((status) => ({
  value: STATUS_TO_FILTER_PARAM[status],
  label: ORDER_STATUS_LABELS[status],
}));

const FILTER_GROUP_KEYS = new Set(
  ORDER_STATUS_FILTER_GROUPS.map((g) => g.value),
);

const ATOMIC_FILTER_PARAMS = new Set(
  ORDER_STATUS_FILTER_OPTIONS.map((o) => o.value),
);

export function orderStatusToFilterParam(status: OrderWorkflowStatus): string {
  return STATUS_TO_FILTER_PARAM[status];
}

export function filterParamToOrderStatus(
  param: string,
): OrderWorkflowStatus | null {
  return FILTER_PARAM_TO_STATUS[param.trim().toLowerCase()] ?? null;
}

export function isKnownStatusFilterToken(token: string): boolean {
  const t = token.trim().toLowerCase();
  return FILTER_GROUP_KEYS.has(t as OrderStatusFilterGroupKey) || ATOMIC_FILTER_PARAMS.has(t);
}

/** Expand group aliases and atomic filter params to workflow statuses. */
export function expandStatusFilterParams(
  params: string[],
): Set<OrderWorkflowStatus> {
  const out = new Set<OrderWorkflowStatus>();
  for (const raw of params) {
    const p = raw.trim().toLowerCase();
    if (p === "unpaid") {
      for (const s of ORDER_STATUS_FILTER_GROUPS[0].statuses) {
        out.add(s);
      }
      continue;
    }
    const status = filterParamToOrderStatus(p);
    if (status) out.add(status);
  }
  return out;
}

export type StatusFilterUrlTokens = {
  groups: OrderStatusFilterGroupKey[];
  atomics: string[];
};

/** Parse `?status=` into group keys and atomic params (known tokens only). */
export function parseStatusFilterUrlTokens(
  param: string | null,
): StatusFilterUrlTokens {
  const groups: OrderStatusFilterGroupKey[] = [];
  const atomics: string[] = [];
  const seen = new Set<string>();
  if (!param?.trim()) return { groups, atomics };

  for (const raw of param.split(",")) {
    const t = raw.trim().toLowerCase();
    if (!t || seen.has(t) || !isKnownStatusFilterToken(t)) continue;
    seen.add(t);
    if (t === "unpaid") {
      groups.push("unpaid");
    } else {
      atomics.push(t);
    }
  }
  return { groups, atomics };
}

function unpaidAtomicsSelected(atomics: string[]): boolean {
  const set = new Set(atomics);
  return UNPAID_FILTER_PARAMS.every((p) => set.has(p));
}

/** Collapse full unpaid atomics into `unpaid` group token. */
export function normalizeStatusFilterTokens(tokens: string[]): string[] {
  const { groups, atomics } = parseStatusFilterUrlTokens(tokens.join(","));
  const groupSet = new Set(groups);
  const atomicSet = new Set(atomics);

  if (groupSet.has("unpaid")) {
    for (const p of UNPAID_FILTER_PARAMS) atomicSet.delete(p);
  } else if (unpaidAtomicsSelected([...atomicSet])) {
    groupSet.add("unpaid");
    for (const p of UNPAID_FILTER_PARAMS) atomicSet.delete(p);
  }

  const out: string[] = [];
  for (const g of ORDER_STATUS_FILTER_GROUPS) {
    if (groupSet.has(g.value)) out.push(g.value);
  }
  for (const opt of ORDER_STATUS_FILTER_OPTIONS) {
    if (atomicSet.has(opt.value)) out.push(opt.value);
  }
  return out;
}

export function statusFilterParamFromTokens(tokens: string[]): string {
  return normalizeStatusFilterTokens(tokens).join(",");
}

/** Labels for the filter trigger (groups + atomics). */
export function statusFilterSelectionLabels(param: string | null): string[] {
  const { groups, atomics } = parseStatusFilterUrlTokens(param);
  const labels: string[] = [];
  for (const g of ORDER_STATUS_FILTER_GROUPS) {
    if (groups.includes(g.value)) labels.push(g.label);
  }
  const skipAtomics = new Set<string>(
    groups.includes("unpaid") ? UNPAID_FILTER_PARAMS : [],
  );
  for (const opt of ORDER_STATUS_FILTER_OPTIONS) {
    if (atomics.includes(opt.value) && !skipAtomics.has(opt.value)) {
      labels.push(opt.label);
    }
  }
  return labels;
}

export function isStatusFilterGroupChecked(
  group: OrderStatusFilterGroupKey,
  param: string | null,
): boolean {
  const { groups, atomics } = parseStatusFilterUrlTokens(param);
  if (groups.includes(group)) return true;
  if (group === "unpaid") return unpaidAtomicsSelected(atomics);
  return false;
}

export function isStatusFilterAtomicChecked(
  atomicParam: string,
  param: string | null,
): boolean {
  const { groups, atomics } = parseStatusFilterUrlTokens(param);
  if (groups.includes("unpaid") && UNPAID_FILTER_PARAMS.includes(atomicParam)) {
    return true;
  }
  return atomics.includes(atomicParam);
}

export function toggleStatusFilterGroup(
  group: OrderStatusFilterGroupKey,
  param: string | null,
): string {
  const { groups, atomics } = parseStatusFilterUrlTokens(param);
  const groupSet = new Set(groups);
  if (groupSet.has(group)) groupSet.delete(group);
  else groupSet.add(group);
  return statusFilterParamFromTokens([...groupSet, ...atomics]);
}

export function toggleStatusFilterAtomic(
  atomicParam: string,
  param: string | null,
): string {
  const { groups, atomics } = parseStatusFilterUrlTokens(param);
  const groupKeys = [...groups];
  let atomicList = [...atomics];
  const checked = isStatusFilterAtomicChecked(atomicParam, param);

  if (checked) {
    if (
      groupKeys.includes("unpaid") &&
      (UNPAID_FILTER_PARAMS as readonly string[]).includes(atomicParam)
    ) {
      const nextGroups = groupKeys.filter((g) => g !== "unpaid");
      atomicList = UNPAID_FILTER_PARAMS.filter((p) => p !== atomicParam);
      return statusFilterParamFromTokens([...nextGroups, ...atomicList]);
    }
    atomicList = atomicList.filter((p) => p !== atomicParam);
  } else {
    atomicList = [...atomicList, atomicParam];
  }
  return statusFilterParamFromTokens([...groupKeys, ...atomicList]);
}
