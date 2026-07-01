-- Repair organizations where Clerk's annual subscription period was stored in
-- usage quota fields. Normalize to monthly anniversary windows without resetting
-- counters when still within the same monthly window.

DO $$
DECLARE
  rec record;
  anchor timestamp;
  end_ts timestamp;
  now_ts timestamp := now();
BEGIN
  FOR rec IN
    SELECT
      id,
      "currentPeriodStart",
      "currentPeriodEnd",
      "ordersThisMonth",
      "eventsCreatedThisMonth"
    FROM "Organization"
    WHERE "currentPeriodEnd" - "currentPeriodStart" > interval '35 days'
  LOOP
    anchor := rec."currentPeriodStart";
    end_ts := anchor + interval '1 month';

    WHILE end_ts <= now_ts LOOP
      anchor := end_ts;
      end_ts := anchor + interval '1 month';
    END LOOP;

    UPDATE "Organization"
    SET
      "currentPeriodStart" = anchor,
      "currentPeriodEnd" = end_ts,
      "ordersThisMonth" = CASE
        WHEN anchor <> rec."currentPeriodStart" THEN 0
        ELSE "ordersThisMonth"
      END,
      "eventsCreatedThisMonth" = CASE
        WHEN anchor <> rec."currentPeriodStart" THEN 0
        ELSE "eventsCreatedThisMonth"
      END
    WHERE id = rec.id;
  END LOOP;
END $$;
