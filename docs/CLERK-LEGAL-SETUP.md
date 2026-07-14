# Clerk legal acceptance setup

Enable seller Terms/Privacy acceptance at sign-up (required for GDPR contractual agreement):

1. Open [Clerk Dashboard](https://dashboard.clerk.com) → **Customization** → **Legal**.
2. Enable **Require express consent to legal documents**.
3. Set URLs (production):
   - Terms of Service: `https://YOUR_DOMAIN/terms`
   - Privacy Policy: `https://YOUR_DOMAIN/privacy`
4. Save. Clerk will show a required checkbox on `<SignUp />` (page + modal).

Our app mirrors acceptance via the `user.created` / `user.updated` webhook into `User.legalAcceptedAt` and `User.legalVersion`.

Existing sellers who signed up before acceptance are gated by the dashboard **LegalReconsentModal** until they accept the current policy version (`CURRENT_POLICY_VERSION` in `src/lib/legalConstants.ts`).
