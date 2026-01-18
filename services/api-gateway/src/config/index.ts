import dotenv from 'dotenv';

dotenv.config();

export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // Kafka
    kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),

    // Microservices URLs
    services: {
        auth: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
        user: process.env.USER_SERVICE_URL || 'http://localhost:3002',
        billing: process.env.BILLING_SERVICE_URL || 'http://localhost:3003',
        notification: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3004',
    },

    // CORS
    corsOrigins: process.env.CORS_ORIGINS?.split(',') || ['http://localhost:5173'],

    // Rate limiting
    rateLimit: {
        windowMs: 60 * 1000, // 1 minute
        max: 100, // requests per window
    },
};
