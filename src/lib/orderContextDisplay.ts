export type OrderContextType = "EVENT" | "STOREFRONT";

export function orderContextKindLabel(contextType: OrderContextType): string {
  return contextType === "EVENT" ? "Event" : "Storefront";
}

export function orderContextHref(
  contextType: OrderContextType,
  contextId: string,
): string {
  return contextType === "EVENT"
    ? `/dashboard/events/${contextId}`
    : `/dashboard/storefronts/${contextId}`;
}
