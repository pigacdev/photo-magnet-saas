import { Router, type Request, type Response } from "express";
import { prisma } from "../lib/prisma";
import { validateOrderCustomerBody } from "../lib/orderCustomerValidation";
import {
  queryCustomerList,
  queryCustomersForExport,
} from "../lib/customerListQuery";
import {
  buildCustomersExportCsv,
  customersExportFilename,
} from "../lib/customersCsvExport";
import { parseCustomerListQuery } from "../lib/sellerCustomerListQuery";
import { eraseBuyerPiiForCustomer } from "../lib/buyerPiiErasure";
import { streamCustomerDataExport } from "../lib/buyerDataExport";
import { deleteAllCustomerImages } from "../lib/orderImageDeletion";
import { logAuditEvent } from "../lib/privacyAuditLog";
import {
  assertOrganizationFeature,
  FEATURE_REQUIRED,
  featureRequiredMessage,
} from "../lib/planFeatures";

export const customersRouter = Router();

async function assertCustomersFeature(
  userId: string,
  res: Response,
): Promise<boolean> {
  try {
    await assertOrganizationFeature(userId, "customers");
    return true;
  } catch (err) {
    if (err instanceof Error && err.message === FEATURE_REQUIRED) {
      res
        .status(403)
        .json({ error: featureRequiredMessage("customers") });
      return false;
    }
    if (err instanceof Error && err.message === "Organization not found") {
      res.status(404).json({ error: "Organization not found" });
      return false;
    }
    throw err;
  }
}

/** GET /api/customers/export.csv */
customersRouter.get("/export.csv", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  if (!(await assertCustomersFeature(userId, res))) return;

  const search =
    typeof req.query.search === "string" ? req.query.search.trim() : "";
  const rows = await queryCustomersForExport(userId, search);
  const csv = buildCustomersExportCsv(rows);
  const filename = customersExportFilename();

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${filename}"`,
  );
  res.send(csv);
});

/** GET /api/customers */
customersRouter.get("/", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  if (!(await assertCustomersFeature(userId, res))) return;

  const parsed = parseCustomerListQuery(
    req.query as Record<string, unknown>,
  );
  if (!parsed.ok) {
    res.status(parsed.error.status).json({ error: parsed.error.error });
    return;
  }

  const result = await queryCustomerList(userId, parsed.params);
  res.json(result);
});

/** GET /api/customers/:id */
customersRouter.get("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  if (!(await assertCustomersFeature(userId, res))) return;

  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "Customer id required" });
    return;
  }

  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: userId, deletedAt: null },
  });
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const orders = await prisma.order.findMany({
    where: { customerId: id, organizationId: userId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      shortCode: true,
      status: true,
      totalPrice: true,
      currency: true,
      createdAt: true,
    },
  });

  res.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      customerSince: customer.createdAt.toISOString(),
    },
    orders: orders.map((o) => ({
      id: o.id,
      shortCode: o.shortCode,
      status: o.status,
      totalPrice: o.totalPrice.toString(),
      currency: o.currency,
      createdAt: o.createdAt.toISOString(),
    })),
  });
});

/** PATCH /api/customers/:id */
customersRouter.patch("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  if (!(await assertCustomersFeature(userId, res))) return;

  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "Customer id required" });
    return;
  }

  const existing = await prisma.customer.findFirst({
    where: { id, organizationId: userId, deletedAt: null },
  });
  if (!existing) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const parsed = validateOrderCustomerBody("EVENT", req.body);
  if ("error" in parsed) {
    res.status(400).json({ error: parsed.error });
    return;
  }
  const { data } = parsed;

  await prisma.customer.update({
    where: { id },
    data: {
      name: data.customerName,
      email: data.customerEmail,
      phone: data.customerPhone,
    },
  });

  res.json({ ok: true });
});

/** GET /api/customers/:id/export.zip — per-buyer DSAR package */
customersRouter.get("/:id/export.zip", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  if (!(await assertCustomersFeature(userId, res))) return;

  const id = String(req.params.id ?? "").trim();
  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: userId, deletedAt: null },
  });
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  await logAuditEvent({
    action: "customer_data_exported",
    actorEmail: seller?.email,
    organizationId: userId,
    targetType: "customer",
    targetId: id,
  });

  await streamCustomerDataExport({
    organizationId: userId,
    customerId: id,
    res,
  });
});

/** POST /api/customers/:id/erase-pii — GDPR erasure for buyer */
customersRouter.post("/:id/erase-pii", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  if (!(await assertCustomersFeature(userId, res))) return;

  const id = String(req.params.id ?? "").trim();
  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const result = await eraseBuyerPiiForCustomer({
    organizationId: userId,
    customerId: id,
    actorEmail: seller?.email,
  });
  if (!result.ok) {
    res.status(result.status).json({ error: result.error });
    return;
  }
  res.json(result.result);
});

/** DELETE /api/customers/:id/images — delete all buyer images */
customersRouter.delete("/:id/images", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  if (!(await assertCustomersFeature(userId, res))) return;

  const id = String(req.params.id ?? "").trim();
  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  const customer = await prisma.customer.findFirst({
    where: { id, organizationId: userId },
  });
  if (!customer) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }
  const result = await deleteAllCustomerImages({
    organizationId: userId,
    customerId: id,
    actorEmail: seller?.email,
  });
  res.json(result);
});

/** DELETE /api/customers/:id — soft delete */
customersRouter.delete("/:id", async (req: Request, res: Response) => {
  const userId = req.user!.userId;
  if (!(await assertCustomersFeature(userId, res))) return;

  const id = String(req.params.id ?? "").trim();
  if (!id) {
    res.status(400).json({ error: "Customer id required" });
    return;
  }

  const existing = await prisma.customer.findFirst({
    where: { id, organizationId: userId, deletedAt: null },
  });
  if (!existing) {
    res.status(404).json({ error: "Customer not found" });
    return;
  }

  await prisma.customer.update({
    where: { id },
    data: { deletedAt: new Date() },
  });

  const seller = await prisma.user.findUnique({
    where: { id: userId },
    select: { email: true },
  });
  await logAuditEvent({
    action: "customer_deleted",
    actorEmail: seller?.email,
    organizationId: userId,
    targetType: "customer",
    targetId: id,
    metadata: { name: existing.name },
  });

  res.json({ ok: true });
});
