export type EarlyAccessStatus = {
  isOpen: boolean;
  seatsTaken: number;
  seatLimit: number;
  seatsRemaining: number;
  userIsEarlyAccess: boolean;
};

/** Prefer `getCachedEarlyAccessStatus()` after `getMe()` — no separate API route. */
export async function fetchEarlyAccessStatus(): Promise<EarlyAccessStatus> {
  const { getMe, getCachedEarlyAccessStatus } = await import("./auth");
  await getMe();
  const status = getCachedEarlyAccessStatus();
  if (!status) {
    throw new Error("Failed to load early access status");
  }
  return status;
}
