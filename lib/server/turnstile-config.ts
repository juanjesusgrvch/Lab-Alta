export const DEFAULT_TURNSTILE_SITE_KEY = "0x4AAAAAAC2ONQ6ycD47hTv0";

export const getTurnstileSiteKey = () =>
  process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim() ||
  process.env.TURNSTILE_SITE_KEY?.trim() ||
  DEFAULT_TURNSTILE_SITE_KEY;
