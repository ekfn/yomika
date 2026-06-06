import { seconds } from "@nestjs/throttler";

export const RATE_LIMIT_ERROR_MESSAGE =
  "Too many requests. Please try again later.";

export const LOGIN_THROTTLER_CONFIG = {
  name: "login",
  limit: 5,
  ttl: seconds(300),
} as const;

export const LOGIN_THROTTLE_OPTIONS = {
  [LOGIN_THROTTLER_CONFIG.name]: {
    limit: LOGIN_THROTTLER_CONFIG.limit,
    ttl: LOGIN_THROTTLER_CONFIG.ttl,
  },
} as const;
