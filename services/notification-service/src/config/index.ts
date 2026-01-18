import dotenv from 'dotenv';
dotenv.config();

export const config = {
    nodeEnv: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3004', 10),
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/subtrack_notifications',
    redisUrl: process.env.REDIS_URL || 'redis://localhost:6379',
    kafkaBrokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    smtp: {
        host: process.env.SMTP_HOST || 'smtp.mailtrap.io',
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        user: process.env.SMTP_USER || '',
        pass: process.env.SMTP_PASS || '',
    },
    fromEmail: process.env.FROM_EMAIL || 'noreply@subtrack.io',
    fromName: process.env.FROM_NAME || 'SubTrack',
};
