import dotenv from 'dotenv';
dotenv.config();

export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3002', 10),
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/subtrack_users',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
};
