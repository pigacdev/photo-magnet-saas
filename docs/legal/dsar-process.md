# DSAR process (Data Subject Access Requests)

Target response time: **30 days** from verified request.

## Request channels

- Email: magnetooprints@gmail.com
- Seller-initiated (for their buyers): Magnetoo dashboard tools

## Verification

- Confirm identity via email reply from the registered address, or
- Seller confirms buyer identity for buyer requests routed through them

## Rights mapping

| Right | Seller (platform user) | Buyer (seller's customer) |
|-------|------------------------|---------------------------|
| **Access** | Settings → Export my data | Seller: Customers → export CSV; per-buyer package `GET /api/customers/:id/export` |
| **Rectification** | Account settings | Seller: edit order customer or CRM record |
| **Erasure** | Settings → Delete account | Seller: Erase customer data; delete images |
| **Portability** | Export my data (JSON/CSV) | Per-buyer export package |
| **Restriction** | Contact support | Contact seller / support |

## Fulfillment steps

1. Log request in audit trail — see [audit-log.md](./audit-log.md)
2. Identify data scope (user ID, customer ID, order IDs)
3. Execute export or erasure via documented endpoints
4. Confirm completion to requester
5. Close ticket within 30 days

## Escalation

Platform owner handles disputes or requests Magnetoo cannot route to a seller.
