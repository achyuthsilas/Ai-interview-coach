/**
 * App configuration.
 * Reads from env vars in production, falls back to localhost in dev.
 */

export const API_URL =
  process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";