export const s3Config = {
  bucket: process.env.S3_BUCKET || "",
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT,
  accessKeyId: process.env.S3_ACCESS_KEY_ID || "",
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY || "",
  maxFileSizeBytes: 10 * 1024 * 1024, // 10 MB
  /** Session uploads (order flow): jpg, png, heic — see Phase 5C. */
  allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
  /** Order session image uploads (multipart). */
  sessionUploadMimeTypes: [
    "image/jpeg",
    "image/png",
    "image/heic",
    "image/heif",
  ] as const,
};
