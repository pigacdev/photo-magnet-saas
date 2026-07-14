import type { Metadata } from "next";
import Link from "next/link";
import { LegalPageShell } from "@/components/legal/LegalPageShell";
import { CURRENT_POLICY_VERSION, LEGAL_LINKS } from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Cookie Policy | Magnetoo",
};

export default function CookiePolicyPage() {
  return (
    <LegalPageShell title="Cookie Policy" lastUpdated={CURRENT_POLICY_VERSION}>
      <section>
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="mt-2 text-muted-foreground">
          Magnetoo uses only strictly necessary cookies and local storage. We do
          not use analytics, advertising, or third-party tracking cookies.
        </p>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Cookies we use</h2>
        <div className="mt-4 overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Purpose</th>
                <th className="py-2 pr-4 font-medium">Duration</th>
                <th className="py-2 font-medium">Type</th>
              </tr>
            </thead>
            <tbody className="text-muted-foreground">
              <tr className="border-b border-border">
                <td className="py-3 pr-4 font-mono text-xs">__session</td>
                <td className="py-3 pr-4">Seller authentication (Clerk)</td>
                <td className="py-3 pr-4">Session</td>
                <td className="py-3">Strictly necessary</td>
              </tr>
              <tr className="border-b border-border">
                <td className="py-3 pr-4 font-mono text-xs">sessionId</td>
                <td className="py-3 pr-4">Anonymous buyer checkout cart</td>
                <td className="py-3 pr-4">30 minutes</td>
                <td className="py-3">Strictly necessary</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Local storage</h2>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>
            <strong>theme</strong> — your light/dark preference (seller UI)
          </li>
          <li>
            <strong>pm_checkoutImageCopies</strong> — temporary checkout state
            (sessionStorage, cleared when the tab closes)
          </li>
          <li>
            <strong>cookie_notice_dismissed</strong> — remembers that you closed
            the cookie notice
          </li>
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold">Future changes</h2>
        <p className="mt-2 text-muted-foreground">
          If we add non-essential cookies (e.g. analytics), we will update this
          policy and request consent before setting them. See also our{" "}
          <Link href={LEGAL_LINKS.privacy} className="text-primary hover:underline">
            Privacy Policy
          </Link>
          .
        </p>
      </section>
    </LegalPageShell>
  );
}
