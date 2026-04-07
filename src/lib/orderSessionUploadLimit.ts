/** Copy aligned with POST /api/session/images when upload count exceeds limit. */
export function formatUploadLimitExceededMessage(max: number): string {
  return `You can upload up to ${max} photos for this order`;
}

export function formatUploadLimitHint(max: number): string {
  return `You can upload up to ${max} photo${max === 1 ? "" : "s"}`;
}
