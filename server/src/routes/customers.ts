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

  res.json({ ok: true });
});
