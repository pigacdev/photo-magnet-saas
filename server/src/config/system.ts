/** Global ceiling for per-order magnet count (admin + session enforcement). */
export const SYSTEM_MAX_MAGNETS_PER_ORDER = 50;

/** Same numeric cap as {@link SYSTEM_MAX_MAGNETS_PER_ORDER} (session image uploads). */
export const SYSTEM_MAX_UPLOAD_LIMIT = SYSTEM_MAX_MAGNETS_PER_ORDER;
