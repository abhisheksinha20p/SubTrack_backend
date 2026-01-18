import dotenv from 'dotenv';

dotenv.config();

export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3001', 10),

    // MongoDB
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/subtrack_auth',

    // JWT
    jwtSecret: process.env.JWT_SECRET || 'your-secret-key',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret',
    jwtAccessExpiry: process.env.JWT_ACCESS_EXPIRY || '15m',
    jwtRefreshExpiry: process.env.JWT_REFRESH_EXPIRY || '7d',

    // Redis
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',

    // Kafka
    kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    kafkaClientId: 'auth-service',

    // Bcrypt
    bcryptRounds: 12,
};
