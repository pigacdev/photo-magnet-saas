import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import {
  CURRENT_POLICY_VERSION,
  LEGAL_ENTITY,
  LEGAL_LINKS,
  LEGAL_RETENTION_DEFAULTS,
} from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Privacy Policy | Magnetoo",
};

export default function PrivacyPolicyPage() {
  const r = LEGAL_RETENTION_DEFAULTS;

  return (
    <LegalPageShell title="Privacy Policy" lastUpdated={CURRENT_POLICY_VERSION}>
      <section>
        <h2 className="text-lg font-semibold">1. Who we are</h2>
        <p className="mt-2 text-muted-foreground">
          {LEGAL_ENTITY.name} ({LEGAL_ENTITY.address}) operates the Magnetoo
          platform. For seller account data we act as the{" "}
          <strong>data controller</strong>. When sellers use Magnetoo to collect
          orders from their customers, we process buyer personal data on behalf
          of the seller as a <strong>data processor</strong>.
        </p>
        <p className="mt-2 text-muted-foreground">
          Contact:{" "}
          <a
            href={`mailto:${LEGAL_ENTITY.contactEmail}`}
            className="text-primary underline-offset-2 hover:underline"
          >
            {LEGAL_ENTITY.contactEmail}
          </a>
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. Data we process</h2>
        <h3 className="mt-3 font-medium">Seller account data (controller)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Name, email, authentication identifiers (via Clerk)</li>
          <li>Business/shop settings, billing and subscription data</li>
          <li>Support communications</li>
        </ul>
        <h3 className="mt-4 font-medium">Buyer order data (processor)</h3>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>Name, email, phone, shipping address (storefront)</li>
          <li>Uploaded photos and crop preferences</li>
          <li>Order and payment status</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. Purposes and legal bases</h2>
        <ul className="mt-2 list-disc space-y-2 pl-5 text-muted-foreground">
          <li>
            <strong>Contract</strong> — providing the Magnetoo service, order
            fulfilment, seller account management, and transactional emails.
          </li>
          <li>
            <strong>Legitimate interest</strong> — fraud prevention, service
            security, internal aggregate/statistical analytics (dashboard and
            event metrics; no third-party tracking), and operational logging.
          </li>
          <li>
            <strong>Consent</strong> — only where explicitly requested (e.g.
            future marketing). Buyer checkout requires acknowledgement of this
            policy and our Terms.
          </li>
          <li>
            <strong>Legal obligation</strong> — retaining minimal billing records
            where required by law.
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. Analytics</h2>
        <p className="mt-2 text-muted-foreground">
          Seller-facing analytics (orders, revenue, magnets sold, trends) are
          computed from your own order data. We do not use third-party analytics
          cookies or trackers. Event &quot;unique customers&quot; counts may
          transiently use buyer phone or name on order records to deduplicate;
          only an aggregate number is shown.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Retention</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            Abandoned checkout session media: {r.abandonedSessionMediaHours}{" "}
            hours
          </li>
          <li>Order image files: {r.orderMediaDays} days after fulfilment</li>
          <li>
            Event media after event end: {r.eventMediaHoursAfterEnd} hours
            (export window)
          </li>
          <li>Print sheet PDFs: {r.printSheetHours} hours</li>
          <li>
            Buyer contact fields on orders: up to {r.orderPiiDays} days, then
            anonymized
          </li>
          <li>
            Seller account erasure: completed within {r.accountErasureGraceDays}{" "}
            days of deletion request
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">6. Subprocessors</h2>
        <p className="mt-2 text-muted-foreground">
          We use trusted providers to run the service. See our{" "}
          <Link href={LEGAL_LINKS.subprocessors} className="text-primary hover:underline">
            Subprocessor list
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">7. International transfers</h2>
        <p className="mt-2 text-muted-foreground">
          Some subprocessors may process data outside the EEA. We rely on
          appropriate safeguards (e.g. Standard Contractual Clauses) where
          required.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">8. Your rights</h2>
        <p className="mt-2 text-muted-foreground">
          Under GDPR you may request access, rectification, erasure, restriction,
          portability, or object to processing. Sellers can manage buyer data via
          the dashboard (export, erase customer data, delete images). Sellers
          may export or delete their own account from dashboard settings.
          Contact us at {LEGAL_ENTITY.contactEmail}. We respond within 30 days.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">9. Cookies</h2>
        <p className="mt-2 text-muted-foreground">
          We use strictly necessary cookies only. See our{" "}
          <Link href={LEGAL_LINKS.cookies} className="text-primary hover:underline">
            Cookie Policy
          </Link>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
