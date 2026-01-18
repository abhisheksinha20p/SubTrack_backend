import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config';
import { connectKafka } from './kafka';
import { notificationRouter, webhookRouter } from './routes/notification.routes';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'notification-service',
        timestamp: new Date().toISOString(),
    });
});

// Routes
app.use('/notifications', notificationRouter);
app.use('/webhooks', webhookRouter);

// Error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Unhandled error:', err);
    res.status(500).json({
        success: false,
        error: { code: 'INTERNAL_ERROR', message: 'Internal server error' },
    });
});

const start = async () => {
    try {
        await mongoose.connect(config.mongoUri);
        logger.info('Connected to MongoDB');

        await connectKafka();

        app.listen(config.port, () => {
            logger.info(`🔔 Notification Service running on port ${config.port}`);
        });
    } catch (error) {
        logger.error('Failed to start Notification Service:', error);
        process.exit(1);
    }
};

start();

export default app;
