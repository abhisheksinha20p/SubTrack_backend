import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config';
import { connectKafka } from './kafka';
import { billingRouter } from './routes/billing.routes';
import { seedPlans } from './seeds/plans.seed';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());

// Raw body for Stripe webhooks
app.use('/billing/webhooks/stripe', express.raw({ type: 'application/json' }));
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'healthy',
        service: 'billing-service',
        timestamp: new Date().toISOString(),
    });
});

// Routes
app.use('/billing', billingRouter);

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

        // Seed default plans
        await seedPlans();

        await connectKafka();

        app.listen(config.port, () => {
            logger.info(`💳 Billing Service running on port ${config.port}`);
        });
    } catch (error) {
        logger.error('Failed to start Billing Service:', error);
        process.exit(1);
    }
};

start();

export default app;
