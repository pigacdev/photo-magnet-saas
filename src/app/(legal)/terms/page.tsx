import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import {
  CURRENT_POLICY_VERSION,
  LEGAL_ENTITY,
  LEGAL_LINKS,
} from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Terms of Service | Magnetoo",
};

export default function TermsPage() {
  return (
    <LegalPageShell title="Terms of Service" lastUpdated={CURRENT_POLICY_VERSION}>
      <section>
        <h2 className="text-lg font-semibold">1. Agreement</h2>
        <p className="mt-2 text-muted-foreground">
          By creating a Magnetoo seller account or placing an order through a
          seller&apos;s storefront or event link, you agree to these Terms and
          our{" "}
          <Link href={LEGAL_LINKS.privacy} className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">2. The service</h2>
        <p className="mt-2 text-muted-foreground">
          Magnetoo provides tools for photo-magnet sellers to accept orders,
          manage images, and generate print-ready output. Sellers are independent
          businesses; {LEGAL_ENTITY.name} is the platform provider, not the
          seller of magnets to end customers.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">3. Seller accounts</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>You must provide accurate registration information.</li>
          <li>You are responsible for your account credentials and team access.</li>
          <li>
            You must comply with GDPR and applicable law when processing buyer
            data. Our Data Processing Agreement applies to buyer data you
            collect through Magnetoo.
          </li>
          <li>Subscription plans and limits are described in the dashboard.</li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">4. Buyer orders</h2>
        <p className="mt-2 text-muted-foreground">
          When you place an order via a seller&apos;s QR or link, you contract
          with that seller for the magnets. Magnetoo processes your data to
          facilitate the order on the seller&apos;s instructions.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">5. Acceptable use</h2>
        <p className="mt-2 text-muted-foreground">
          You may not upload unlawful content, infringe intellectual property,
          abuse the platform, or attempt to bypass security or rate limits.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">6. Termination</h2>
        <p className="mt-2 text-muted-foreground">
          Sellers may delete their account from settings. We may suspend accounts
          that violate these Terms. Data handling after termination is described
          in the Privacy Policy.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">7. Limitation of liability</h2>
        <p className="mt-2 text-muted-foreground">
          The service is provided as-is to the extent permitted by law. Our
          liability is limited to fees paid in the twelve months preceding a
          claim, except where mandatory law provides otherwise.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">8. Contact</h2>
        <p className="mt-2 text-muted-foreground">
          {LEGAL_ENTITY.name} —{" "}
          <a
            href={`mailto:${LEGAL_ENTITY.contactEmail}`}
            className="text-primary hover:underline"
          >
            {LEGAL_ENTITY.contactEmail}
          </a>
        </p>
      </section>
    </LegalPageShell>
  );
}
