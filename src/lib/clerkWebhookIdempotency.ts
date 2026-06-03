import { prisma } from "./prisma";

export async function isClerkEventProcessed(svixId: string): Promise<boolean> {
  const row = await prisma.processedClerkEvent.findUnique({
    where: { id: svixId },
    select: { id: true },
  });
  return row !== null;
}

export async function markClerkEventProcessed(svixId: string): Promise<void> {
  try {
    await prisma.processedClerkEvent.create({
      data: { id: svixId },
    });
  } catch {
    // Concurrent retry — treat as processed
  }
}
