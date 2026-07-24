import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import {
  EARLY_ACCESS_OFFER_SCOPE,
  EARLY_ACCESS_PARTICIPATION_TERMS,
} from "@/lib/earlyAccessCopy";
import {
  EARLY_ACCESS_DISCOUNT_TERMS_VERSION,
  LEGAL_LINKS,
} from "@/lib/legalConstants";

const BRAND = "Magnetoo Studio";
const CONTACT_EMAIL = "magnetoostudio@gmail.com";

export const metadata: Metadata = {
  title: `Early Access Lifetime Discount Terms | ${BRAND}`,
};

export default function EarlyAccessDiscountTermsPage() {
  return (
    <LegalPageShell
      title="Early Access Lifetime Discount Terms"
      lastUpdated={EARLY_ACCESS_DISCOUNT_TERMS_VERSION}
    >
      <section>
        <h2 className="text-lg font-semibold">1. Overview</h2>
        <p className="mt-2 text-muted-foreground">
          {BRAND} may offer a limited early-access launch cohort for sellers who
          help validate the product before wider release. As part of that program,
          eligible participants may receive optional lifetime loyalty pricing on
          paid Hobby and Pro subscriptions, subject to these terms.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. Discount</h2>
        <p className="mt-2 text-muted-foreground">
          The lifetime discount is <strong>20% off</strong>{" "}
          the standard recurring price of an eligible paid Hobby or Pro subscription
          for as long as you maintain that paid subscription. Discounted pricing is
          applied through {BRAND}&apos;s billing provider (Clerk) using loyalty plan
          pricing associated with your subscription.
        </p>
        <p className="mt-2 text-muted-foreground">
          The discount applies to subscription fees only. It does not apply to the
          Free plan, one-time charges outside your subscription, or third-party
          fees.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. Eligibility &amp; active participation</h2>
        <p className="mt-2 text-muted-foreground">
          The lifetime discount is <strong>not automatic</strong>. It is offered
          only to early-access sellers who actively participate in testing {BRAND}{" "}
          during the launch period.
        </p>
        <p className="mt-2 text-muted-foreground">{EARLY_ACCESS_PARTICIPATION_TERMS}</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Run real events or otherwise use {BRAND} in realistic selling
            scenarios.
          </li>
          <li>Try product features and workflows relevant to your business.</li>
          <li>
            Report bugs, defects, or unexpected behavior when you encounter them.
          </li>
          <li>
            Share constructive feedback through {BRAND} Support or our community
            channels (for example Discord).
          </li>
        </ul>
        <p className="mt-2 text-muted-foreground">
          {BRAND} reviews participation and decides whether to grant, withhold, or
          revoke the discount at its sole discretion.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. How the discount is granted</h2>
        <p className="mt-2 text-muted-foreground">
          If you qualify, {BRAND} enables loyalty pricing on your account before
          your early-access trial ends (typically a few days before billing begins
          at the paid rate). If you do not meet the participation requirements,
          standard pricing applies when your trial ends.
        </p>
        <p className="mt-2 text-muted-foreground">
          We may revoke the discount if you stop participating meaningfully, abuse
          the program, or violate our{" "}
          <Link href={LEGAL_LINKS.terms} className="text-primary hover:underline">
            Terms of Service
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Account binding</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            The discount is tied to the seller account email address and
            organization that earned it.
          </li>
          <li>
            It is <strong>not transferable</strong> to another person, email
            address, or organization.
          </li>
          <li>It has no cash value and cannot be sold, assigned, or exchanged.</li>
          <li>
            If your organization changes ownership or you create a new account to
            circumvent these rules, {BRAND} may decline or remove the discount.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">6. Early access program</h2>
        <p className="mt-2 text-muted-foreground">
          {EARLY_ACCESS_OFFER_SCOPE}. During the launch window, Hobby and Pro may
          include a 60-day free trial while early-access seats remain. A payment
          method is required. The Free plan is excluded from the early-access
          trial offer. After the launch cohort is full, new sellers subscribe at
          standard public pricing unless otherwise stated by {BRAND}.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">7. Subscription changes</h2>
        <p className="mt-2 text-muted-foreground">
          The discount applies only while you maintain an eligible paid Hobby or
          Pro subscription. If you downgrade to the Free plan or cancel paid
          billing, loyalty pricing no longer applies. If you resubscribe later,
          {BRAND} may restore the discount only if your account remains eligible
          under these terms and our records.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">8. Changes &amp; termination</h2>
        <p className="mt-2 text-muted-foreground">
          {BRAND} may amend, suspend, or end the early-access program or these
          discount terms at any time. Material changes will be posted on this page
          with an updated &quot;Last updated&quot; date. Continued participation
          after changes constitutes acceptance of the revised terms where
          permitted by law.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">9. Relationship to other policies</h2>
        <p className="mt-2 text-muted-foreground">
          These terms supplement, and do not replace, our{" "}
          <Link href={LEGAL_LINKS.terms} className="text-primary hover:underline">
            Terms of Service
          </Link>{" "}
          and{" "}
          <Link href={LEGAL_LINKS.privacy} className="text-primary hover:underline">
            Privacy Policy
          </Link>
          . If there is a conflict, the main Terms of Service govern your use of{" "}
          {BRAND} except where these terms specifically describe the early-access
          discount program.
        </p>
        <p className="mt-2 text-muted-foreground">
          Questions:{" "}
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            className="text-primary hover:underline"
          >
            {CONTACT_EMAIL}
          </a>
        </p>
      </section>
    </LegalPageShell>
  );
}
