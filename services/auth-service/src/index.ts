import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { config } from './config';
import { connectDatabase } from './database';
import { connectKafka } from './kafka';
import { errorHandler } from './middleware/errorHandler';
import { authRouter } from './routes/auth';
import { healthRouter } from './routes/health';
import { logger } from './utils/logger';

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());

// Routes
app.use('/health', healthRouter);
app.use('/auth', authRouter);

// Error handling
app.use(errorHandler);

const start = async () => {
    try {
        // Connect to MongoDB
        await connectDatabase();
        logger.info('Connected to MongoDB');

        // Connect to Kafka
        // await connectKafka();
        // logger.info('Connected to Kafka');

        // Start server
        app.listen(config.port, () => {
            logger.info(`🔐 Auth Service running on port ${config.port}`);
        });
    } catch (error) {
        logger.error('Failed to start Auth Service:', error);
        process.exit(1);
    }
};

start();

export default app;
