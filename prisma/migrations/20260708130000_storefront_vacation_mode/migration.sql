-- AlterTable
ALTER TABLE "Storefront" ADD COLUMN "vacationFrom" TIMESTAMP(3),
ADD COLUMN "vacationTo" TIMESTAMP(3),
ADD COLUMN "vacationNote" VARCHAR(500);
