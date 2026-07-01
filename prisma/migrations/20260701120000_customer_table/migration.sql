-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Order" ADD COLUMN "customerId" TEXT;

-- CreateIndex
CREATE INDEX "Customer_organizationId_idx" ON "Customer"("organizationId");

-- CreateIndex
CREATE INDEX "Customer_organizationId_deletedAt_idx" ON "Customer"("organizationId", "deletedAt");

-- CreateIndex
CREATE INDEX "Customer_organizationId_email_idx" ON "Customer"("organizationId", "email");

-- CreateIndex
CREATE INDEX "Customer_organizationId_phone_idx" ON "Customer"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "Order_customerId_idx" ON "Order"("customerId");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill customers from existing orders (email first, then phone)
CREATE TEMP TABLE "_customer_backfill_map" (
    "organizationId" TEXT NOT NULL,
    "identity_key" TEXT NOT NULL,
    "customer_id" TEXT NOT NULL,
    PRIMARY KEY ("organizationId", "identity_key")
);

WITH order_identity AS (
    SELECT
        o."id" AS order_id,
        o."organizationId",
        TRIM(o."customerName") AS customer_name,
        NULLIF(TRIM(o."customerEmail"), '') AS customer_email,
        NULLIF(TRIM(o."customerPhone"), '') AS customer_phone,
        o."createdAt",
        CASE
            WHEN NULLIF(TRIM(o."customerEmail"), '') IS NOT NULL THEN
                'email:' || LOWER(TRIM(o."customerEmail"))
            WHEN NULLIF(TRIM(o."customerPhone"), '') IS NOT NULL THEN
                'phone:' || REGEXP_REPLACE(TRIM(o."customerPhone"), '[^\d+]', '', 'g')
            ELSE NULL
        END AS identity_key
    FROM "Order" o
    WHERE NULLIF(TRIM(o."customerName"), '') IS NOT NULL
),
first_seen AS (
    SELECT
        "organizationId",
        identity_key,
        MIN("createdAt") AS first_seen
    FROM order_identity
    WHERE identity_key IS NOT NULL
    GROUP BY "organizationId", identity_key
),
latest_contact AS (
    SELECT DISTINCT ON ("organizationId", identity_key)
        "organizationId",
        identity_key,
        customer_name,
        customer_email,
        customer_phone
    FROM order_identity
    WHERE identity_key IS NOT NULL
    ORDER BY "organizationId", identity_key, "createdAt" DESC
),
to_insert AS (
    SELECT
        gen_random_uuid()::TEXT AS customer_id,
        fs."organizationId",
        fs.identity_key,
        lc.customer_name,
        lc.customer_email,
        lc.customer_phone,
        fs.first_seen
    FROM first_seen fs
    JOIN latest_contact lc
        ON lc."organizationId" = fs."organizationId"
        AND lc.identity_key = fs.identity_key
)
INSERT INTO "Customer" ("id", "organizationId", "name", "email", "phone", "createdAt", "updatedAt")
SELECT
    ti.customer_id,
    ti."organizationId",
    ti.customer_name,
    ti.customer_email,
    ti.customer_phone,
    ti.first_seen,
    CURRENT_TIMESTAMP
FROM to_insert ti;

INSERT INTO "_customer_backfill_map" ("organizationId", "identity_key", "customer_id")
SELECT
    c."organizationId",
    CASE
        WHEN NULLIF(TRIM(c."email"), '') IS NOT NULL THEN
            'email:' || LOWER(TRIM(c."email"))
        WHEN NULLIF(TRIM(c."phone"), '') IS NOT NULL THEN
            'phone:' || REGEXP_REPLACE(TRIM(c."phone"), '[^\d+]', '', 'g')
        ELSE NULL
    END,
    c."id"
FROM "Customer" c
WHERE c."deletedAt" IS NULL
  AND (
    NULLIF(TRIM(c."email"), '') IS NOT NULL
    OR NULLIF(TRIM(c."phone"), '') IS NOT NULL
  );

UPDATE "Order" o
SET "customerId" = m.customer_id
FROM (
    SELECT
        oi.order_id,
        map.customer_id
    FROM (
        SELECT
            o."id" AS order_id,
            o."organizationId",
            CASE
                WHEN NULLIF(TRIM(o."customerEmail"), '') IS NOT NULL THEN
                    'email:' || LOWER(TRIM(o."customerEmail"))
                WHEN NULLIF(TRIM(o."customerPhone"), '') IS NOT NULL THEN
                    'phone:' || REGEXP_REPLACE(TRIM(o."customerPhone"), '[^\d+]', '', 'g')
                ELSE NULL
            END AS identity_key
        FROM "Order" o
    ) oi
    JOIN "_customer_backfill_map" map
        ON map."organizationId" = oi."organizationId"
        AND map.identity_key = oi.identity_key
    WHERE oi.identity_key IS NOT NULL
) m
WHERE o."id" = m.order_id;

DROP TABLE "_customer_backfill_map";
