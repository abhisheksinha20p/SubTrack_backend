import { Request, Response, NextFunction } from 'express';
import { RateLimiterRedis } from 'rate-limiter-flexible';
import Redis from 'ioredis';
import { config } from '../config';
import { logger } from '../utils/logger';

let rateLimiterInstance: RateLimiterRedis | null = null;

const initRateLimiter = () => {
    if (rateLimiterInstance) return rateLimiterInstance;

    try {
        const redisClient = new Redis(config.redisUrl);

        rateLimiterInstance = new RateLimiterRedis({
            storeClient: redisClient,
            keyPrefix: 'ratelimit',
            points: config.rateLimit.max,
            duration: config.rateLimit.windowMs / 1000, // seconds
        });

        logger.info('Rate limiter initialized with Redis');
        return rateLimiterInstance;
    } catch (error) {
        logger.warn('Redis not available, rate limiting disabled');
        return null;
    }
};

export const rateLimiter = async (req: Request, res: Response, next: NextFunction) => {
    const limiter = initRateLimiter();

    if (!limiter) {
        return next();
    }

    try {
        // Use user ID if authenticated, otherwise IP
        const key = (req as any).user?.id || req.ip;
        await limiter.consume(key);
        next();
    } catch (error: any) {
        if (error.remainingPoints !== undefined) {
            res.set({
                'Retry-After': Math.ceil(error.msBeforeNext / 1000),
                'X-RateLimit-Limit': config.rateLimit.max,
                'X-RateLimit-Remaining': error.remainingPoints,
            });

            return res.status(429).json({
                success: false,
                error: {
                    code: 'RATE_LIMITED',
                    message: 'Too many requests, please try again later',
                    retryAfter: Math.ceil(error.msBeforeNext / 1000),
                },
            });
        }
        next(error);
    }
};
