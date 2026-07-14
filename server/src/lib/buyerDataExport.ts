import archiver from "archiver";
import type { Response } from "express";
import { prisma } from "./prisma";
import { buildOrdersExportCsv } from "./ordersCsvExport";

/** Stream a per-buyer DSAR export package (orders CSV + manifest). */
export async function streamCustomerDataExport(params: {
  organizationId: string;
  customerId: string;
  res: Response;
}): Promise<void> {
  const customer = await prisma.customer.findFirst({
    where: {
      id: params.customerId,
      organizationId: params.organizationId,
      deletedAt: null,
    },
  });
  if (!customer) {
    params.res.status(404).json({ error: "Customer not found" });
    return;
  }

  const orders = await prisma.order.findMany({
    where: { customerId: params.customerId, organizationId: params.organizationId },
    orderBy: { createdAt: "desc" },
    include: {
      orderImages: {
        select: {
          id: true,
          position: true,
          copies: true,
          deletedAt: true,
          createdAt: true,
        },
      },
    },
  });

  params.res.setHeader("Content-Type", "application/zip");
  params.res.setHeader(
    "Content-Disposition",
    `attachment; filename="customer-${params.customerId}-export.zip"`,
  );

  const archive = archiver("zip", { zlib: { level: 9 } });
  archive.on("error", (err) => {
    throw err;
  });
  archive.pipe(params.res);

  archive.append(
    JSON.stringify(
      {
        customer: {
          id: customer.id,
          name: customer.name,
          email: customer.email,
          phone: customer.phone,
          createdAt: customer.createdAt.toISOString(),
        },
        orders: orders.map((o) => ({
          id: o.id,
          status: o.status,
          totalPrice: o.totalPrice.toString(),
          currency: o.currency,
          customerName: o.customerName,
          customerEmail: o.customerEmail,
          customerPhone: o.customerPhone,
          createdAt: o.createdAt.toISOString(),
          images: o.orderImages,
        })),
      },
      null,
      2,
    ),
    { name: "data.json" },
  );

  const orderRows = orders.map((o) => ({
    row: {
      id: o.id,
      shortCode: o.shortCode,
      status: o.status,
      totalPrice: o.totalPrice,
      currency: o.currency,
      customerName: o.customerName,
      customerEmail: o.customerEmail,
      customerPhone: o.customerPhone,
      createdAt: o.createdAt,
    },
  }));
  archive.append(buildOrdersExportCsv(orderRows), { name: "orders.csv" });

  await archive.finalize();
}
