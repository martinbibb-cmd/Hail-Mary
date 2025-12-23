/**
 * Feature flags (PWA)
 *
 * Tonight's scope: Atlas is a media receiver only.
 * - Disable in-app media creation (camera/recording capture UI)
 * - Allow importing media to a lead/visit
 */

export const MEDIA_RECEIVER_ONLY =
  (import.meta.env.VITE_MEDIA_RECEIVER_ONLY ?? "true") === "true";

