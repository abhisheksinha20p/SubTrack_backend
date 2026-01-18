import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import mongoose from 'mongoose';
import { config } from './config';
import { connectKafka } from './kafka';
import { userRouter } from './routes/user.routes';
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
        service: 'user-service',
        timestamp: new Date().toISOString(),
    });
});

// Routes
app.use('/users', userRouter);

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
        // Connect to MongoDB
        await mongoose.connect(config.mongoUri);
        logger.info('Connected to MongoDB');

        // Connect to Kafka
        await connectKafka();

        // Start server
        app.listen(config.port, () => {
            logger.info(`👤 User Service running on port ${config.port}`);
        });
    } catch (error) {
        logger.error('Failed to start User Service:', error);
        process.exit(1);
    }
};

start();

export default app;
