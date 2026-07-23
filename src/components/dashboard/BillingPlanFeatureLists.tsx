"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import {
  billingPlanColumnsForPhase,
  type BillingPlanColumn,
  type BillingPlanColumnSlug,
} from "@/lib/billingPlanDisplay";

const MOBILE_MQ = "(max-width: 639.98px)";

const SLUG_ORDER: readonly BillingPlanColumnSlug[] = [
  "free_user",
  "hobby",
  "pro",
];

const PLAN_TITLE: Record<BillingPlanColumnSlug, string> = {
  free_user: "Free",
  hobby: "Hobby",
  pro: "Pro",
};

const ANCHOR_ATTR = "data-billing-feature-anchor";

function planHosts(root: Element): Partial<Record<BillingPlanColumnSlug, Element>> {
  const cards = [
    ...root.querySelectorAll(".magnetoo-clerk-pricing-card"),
  ];

  const byTitle: Partial<Record<BillingPlanColumnSlug, Element>> = {};
  for (const card of cards) {
    const host = (card.closest("[id]") as Element | null) ?? card;
    const heading = [
      ...card.querySelectorAll("h1,h2,h3,h4,h5,[class*='Title'],[class*='title']"),
    ]
      .map((el) => el.textContent?.trim() ?? "")
      .find(Boolean);
    const title = heading ?? "";
    if (title === "Free") byTitle.free_user ??= host;
    else if (title === "Hobby") byTitle.hobby ??= host;
    else if (title === "Pro") byTitle.pro ??= host;
  }

  if (byTitle.free_user && byTitle.hobby && byTitle.pro) {
    return byTitle;
  }

  // Fallback: Clerk usually renders Free → Hobby → Pro in DOM order.
  const byIndex: Partial<Record<BillingPlanColumnSlug, Element>> = { ...byTitle };
  SLUG_ORDER.forEach((slug, i) => {
    const card = cards[i];
    if (!byIndex[slug] && card) {
      byIndex[slug] = (card.closest("[id]") as Element | null) ?? card;
    }
  });
  return byIndex;
}

function ensureAnchor(card: Element, slug: BillingPlanColumnSlug): HTMLElement {
  // Prefer the visual card shell so skills sit flush under the bordered box.
  const shell =
    card.classList?.contains("magnetoo-clerk-pricing-card")
      ? card
      : (card.querySelector(".magnetoo-clerk-pricing-card") ?? card);

  const next = shell.nextElementSibling;
  if (
    next instanceof HTMLElement &&
    next.getAttribute(ANCHOR_ATTR) === slug
  ) {
    return next;
  }
  // Drop a stale misplaced anchor for this slug if present elsewhere under layout.
  const root = shell.closest(".billing-plans-layout");
  root
    ?.querySelectorAll(`[${ANCHOR_ATTR}="${slug}"]`)
    .forEach((el) => {
      if (el !== next) el.remove();
    });

  const anchor = document.createElement("div");
  anchor.setAttribute(ANCHOR_ATTR, slug);
  anchor.className = "billing-plan-feature-anchor";
  shell.after(anchor);
  return anchor;
}

function clearAnchors(root: Element) {
  root.querySelectorAll(`[${ANCHOR_ATTR}]`).forEach((el) => el.remove());
}

export function BillingPlanFeatureLists({
  earlyAccessOpen = false,
}: {
  earlyAccessOpen?: boolean;
}) {
  const columns = billingPlanColumnsForPhase(earlyAccessOpen);
  const [mobile, setMobile] = useState(false);
  const [anchors, setAnchors] = useState<
    Partial<Record<BillingPlanColumnSlug, HTMLElement>>
  >({});

  useEffect(() => {
    const mq = window.matchMedia(MOBILE_MQ);
    const layout = () => document.querySelector(".billing-plans-layout");

    let frame = 0;

    function sync() {
      const root = layout();
      if (!root) return;

      const isMobile = mq.matches;
      setMobile((prev) => (prev === isMobile ? prev : isMobile));

      if (!isMobile) {
        clearAnchors(root);
        setAnchors((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        return;
      }

      const hosts = planHosts(root);
      const next: Partial<Record<BillingPlanColumnSlug, HTMLElement>> = {};
      for (const slug of SLUG_ORDER) {
        const host = hosts[slug];
        if (!host) continue;
        next[slug] = ensureAnchor(host, slug);
      }

      const complete =
        Boolean(next.free_user) &&
        Boolean(next.hobby) &&
        Boolean(next.pro);

      if (!complete) {
        // Prefer a visible labeled list over partial/broken attachment.
        clearAnchors(root);
        setAnchors((prev) => (Object.keys(prev).length === 0 ? prev : {}));
        return;
      }

      setAnchors((prev) => {
        if (
          prev.free_user === next.free_user &&
          prev.hobby === next.hobby &&
          prev.pro === next.pro
        ) {
          return prev;
        }
        return next;
      });
    }

    function scheduleSync() {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(sync);
    }

    scheduleSync();
    mq.addEventListener("change", scheduleSync);

    const root = layout();
    const observer = root
      ? new MutationObserver(scheduleSync)
      : null;
    observer?.observe(root!, { childList: true, subtree: true });

    return () => {
      cancelAnimationFrame(frame);
      mq.removeEventListener("change", scheduleSync);
      observer?.disconnect();
      const el = layout();
      if (el) clearAnchors(el);
    };
  }, [earlyAccessOpen]);

  const attachedCount = SLUG_ORDER.filter((s) => anchors[s]).length;
  const usePortals = mobile && attachedCount === 3;

  if (usePortals) {
    return (
      <>
        {columns.map((plan) => {
          const anchor = anchors[plan.slug];
          if (!anchor) return null;
          return createPortal(
            <FeatureColumn key={plan.slug} plan={plan} showHeading={false} />,
            anchor,
          );
        })}
      </>
    );
  }

  // Desktop, or mobile fallback while Clerk cards are missing / unmatched:
  // keep features visible (labeled on mobile so detached lists stay clear).
  return (
    <div
      className={`billing-plan-features-grid${mobile ? " billing-plan-features-grid--mobile-fallback" : ""}`}
      aria-label="Plan features"
    >
      {columns.map((plan) => (
        <FeatureColumn
          key={plan.slug}
          plan={plan}
          showHeading={mobile}
        />
      ))}
    </div>
  );
}

function FeatureColumn({
  plan,
  showHeading,
}: {
  plan: BillingPlanColumn;
  showHeading: boolean;
}) {
  return (
    <div
      className={`billing-plan-features-col billing-plan-features-col--${plan.slug}`}
      aria-label={`${PLAN_TITLE[plan.slug]} plan features`}
    >
      {showHeading ? (
        <p className="billing-plan-features-heading">
          {PLAN_TITLE[plan.slug]}
        </p>
      ) : null}
      <ul className="space-y-2.5">
        {plan.features.map((feature) => (
          <li
            key={feature}
            className="flex items-start gap-2 text-sm text-foreground"
          >
            <span className="mt-0.5 shrink-0 text-primary" aria-hidden>
              ✓
            </span>
            <span>{feature}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
