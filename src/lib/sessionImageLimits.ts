/**
 * Multer max files per request (memory bound). Real per-session limit comes from
 * `getMaxImagesAllowed` on the server (GET /api/session includes `maxImagesAllowed`).
 */
export const MAX_MULTIPART_FILES_PER_REQUEST = 1000;

/** Fallback when shape tier is unknown. Upload uses `getMinRequiredPx` for low-res flag. */
export const MIN_PRINT_SIZE = 800;

/** Alias of MIN_PRINT_SIZE for older references. */
export const SESSION_IMAGE_MIN_EDGE_PX = MIN_PRINT_SIZE;
