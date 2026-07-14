import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { CURRENT_POLICY_VERSION, LEGAL_ENTITY } from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Imprint | Magnetoo",
};

export default function ImprintPage() {
  return (
    <LegalPageShell title="Imprint" lastUpdated={CURRENT_POLICY_VERSION}>
      <section>
        <h2 className="text-lg font-semibold">Service provider</h2>
        <p className="mt-2 text-muted-foreground">
          {LEGAL_ENTITY.name}
          <br />
          {LEGAL_ENTITY.address}
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="mt-2 text-muted-foreground">
          Email:{" "}
          <a
            href={`mailto:${LEGAL_ENTITY.contactEmail}`}
            className="text-primary hover:underline"
          >
            {LEGAL_ENTITY.contactEmail}
          </a>
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Responsible for content</h2>
        <p className="mt-2 text-muted-foreground">
          Platform operator as named above. Individual sellers are responsible
          for content and products offered through their storefronts and events.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Dispute resolution</h2>
        <p className="mt-2 text-muted-foreground">
          The European Commission provides an online dispute resolution platform
          at{" "}
          <a
            href="https://ec.europa.eu/consumers/odr"
            className="text-primary hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            ec.europa.eu/consumers/odr
          </a>
          . We are not obliged to participate in consumer arbitration boards.
        </p>
      </section>
    </LegalPageShell>
  );
}
