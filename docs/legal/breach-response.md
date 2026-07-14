# Personal data breach response

GDPR Art. 33–34. Target: **72 hours** to supervisory authority where required.

## 1. Detect

Sources: monitoring alerts, subprocessors (Clerk, AWS), support reports, audit logs.

## 2. Contain

- Revoke compromised credentials
- Block affected endpoints if active exploit
- Preserve logs for investigation

## 3. Assess

- What data categories affected?
- How many data subjects?
- Likely risk to rights and freedoms?
- Controller vs processor role (seller buyer data vs seller account data)

## 4. Notify

| Audience | When |
|----------|------|
| Supervisory authority | Within 72h if risk to individuals |
| Affected sellers | Without undue delay if high risk to their buyer data |
| Affected buyers | When high risk; via seller where Magnetoo is processor |

## 5. Document

Record in incident log: timeline, data affected, remediation, notifications sent.

## 6. Review

Post-incident review; update RoPA and technical controls if needed.

## Contacts

- Platform owner: PLATFORM_OWNER_EMAILS env
- DPA subprocessors: see subprocessors.md
