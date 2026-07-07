/** Matches Prisma `VarChar(100)`; enforced on API save. */
export const EVENT_NAME_MAX_LEN = 100;

export function validateEventNameInput(
  name: string,
): { ok: true; value: string } | { ok: false; error: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { ok: false, error: "Event name is required" };
  }
  if (trimmed.length > EVENT_NAME_MAX_LEN) {
    return {
      ok: false,
      error: `Event name must be ${EVENT_NAME_MAX_LEN} characters or fewer`,
    };
  }
  return { ok: true, value: trimmed };
}
