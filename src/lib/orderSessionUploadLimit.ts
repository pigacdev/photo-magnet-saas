/** Copy aligned with POST /api/session/images when upload count exceeds limit. */
export function formatUploadLimitExceededMessage(max: number): string {
  return `You can upload up to ${max} photos for this order`;
}

export function formatUploadLimitHint(max: number): string {
  return `You can upload up to ${max} photo${max === 1 ? "" : "s"}`;
}

export function formatBundleMagnetProgress(
  totalMagnets: number,
  requiredMagnets: number,
): string {
  return `${totalMagnets} of ${requiredMagnets} magnet${requiredMagnets === 1 ? "" : "s"} selected`;
}

export function formatBundleMagnetUploadExceeded(required: number): string {
  return `This bundle includes ${required} magnet${required === 1 ? "" : "s"}. Adjust copies or upload fewer photos.`;
}

export function formatBundleAdjustCopiesHint(): string {
  return "Adjust copies on your photos to fill the bundle.";
}
