-- Coerce Order.paymentStatus to values defined in Prisma enum PaymentStatus
-- (PENDING, PAID, CASH, FAILED). Rows with legacy labels (e.g. UNPAID) break Prisma reads.
UPDATE "Order"
SET "paymentStatus" = 'PENDING'::"PaymentStatus"
WHERE "paymentStatus"::text NOT IN ('PENDING', 'PAID', 'CASH', 'FAILED');
