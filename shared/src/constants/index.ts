// Shared Constants

export const JWT_CONFIG = {
    ACCESS_TOKEN_EXPIRY: '15m',
    REFRESH_TOKEN_EXPIRY: '7d',
} as const;

export const RATE_LIMITS = {
    DEFAULT: {
        windowMs: 60 * 1000, // 1 minute
        max: 100,
    },
    AUTH: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 10,
    },
} as const;

export const PAGINATION = {
    DEFAULT_PAGE: 1,
    DEFAULT_LIMIT: 20,
    MAX_LIMIT: 100,
} as const;

export const SERVICE_PORTS = {
    API_GATEWAY: 3000,
    AUTH_SERVICE: 3001,
    USER_SERVICE: 3002,
    BILLING_SERVICE: 3003,
    NOTIFICATION_SERVICE: 3004,
} as const;

export const HTTP_STATUS = {
    OK: 200,
    CREATED: 201,
    NO_CONTENT: 204,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    CONFLICT: 409,
    UNPROCESSABLE_ENTITY: 422,
    TOO_MANY_REQUESTS: 429,
    INTERNAL_SERVER_ERROR: 500,
    BAD_GATEWAY: 502,
    SERVICE_UNAVAILABLE: 503,
} as const;
