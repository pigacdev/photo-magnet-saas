import type { Metadata } from "next";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { CURRENT_POLICY_VERSION } from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Subprocessors | Magnetoo",
};

const SUBPROCESSORS = [
  {
    name: "Clerk",
    purpose: "Seller authentication and billing UI",
    location: "United States / EU (region-dependent)",
    data: "Email, name, session tokens",
  },
  {
    name: "Stripe",
    purpose: "Legacy subscription payments (where applicable)",
    location: "United States / EU",
    data: "Billing identifiers",
  },
  {
    name: "Amazon Web Services (S3)",
    purpose: "Image and file storage",
    location: "Configurable region (e.g. EU)",
    data: "Uploaded photos, banners, print files",
  },
  {
    name: "Resend",
    purpose: "Transactional email delivery",
    location: "United States",
    data: "Email addresses, order notification content",
  },
  {
    name: "PostgreSQL hosting",
    purpose: "Application database",
    location: "Per deployment",
    data: "All application data at rest",
  },
] as const;

export default function SubprocessorsPage() {
  return (
    <LegalPageShell title="Subprocessors" lastUpdated={CURRENT_POLICY_VERSION}>
      <p className="text-muted-foreground">
        Magnetoo uses the following subprocessors to deliver the service. We
        require appropriate data protection terms with each provider.
      </p>
      <div className="mt-6 overflow-x-auto">
        <table className="w-full border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="py-2 pr-4 font-medium">Provider</th>
              <th className="py-2 pr-4 font-medium">Purpose</th>
              <th className="py-2 pr-4 font-medium">Location</th>
              <th className="py-2 font-medium">Data processed</th>
            </tr>
          </thead>
          <tbody className="text-muted-foreground">
            {SUBPROCESSORS.map((row) => (
              <tr key={row.name} className="border-b border-border">
                <td className="py-3 pr-4 font-medium text-foreground">
                  {row.name}
                </td>
                <td className="py-3 pr-4">{row.purpose}</td>
                <td className="py-3 pr-4">{row.location}</td>
                <td className="py-3">{row.data}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </LegalPageShell>
  );
}
