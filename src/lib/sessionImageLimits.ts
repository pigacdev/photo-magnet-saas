/**
 * Multer max files per request (memory bound). Real per-session limit comes from
 * `getMaxImagesAllowed` on the server (GET /api/session includes `maxImagesAllowed`).
 */
export const MAX_MULTIPART_FILES_PER_REQUEST = 1000;

/** Minimum edge length (px) for full-quality flag; below this → `isLowResolution` on SessionImage. Safe default until crop uses shape mm. */
export const SESSION_IMAGE_MIN_EDGE_PX = 800;
