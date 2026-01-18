import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { config } from './config';
import { errorHandler } from './middleware/errorHandler';
import { rateLimiter } from './middleware/rateLimiter';
import { authMiddleware } from './middleware/auth';
import { setupProxies } from './proxy';
import { healthRouter } from './routes/health';
import { statsRouter } from './routes/stats';
import { logger } from './utils/logger';

const app = express();

// Security middleware
app.use(helmet());
app.use(cors({
    origin: config.corsOrigins,
    credentials: true,
}));

// Request parsing
// Request parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Logging
app.use(morgan('combined', { stream: { write: (msg) => logger.info(msg.trim()) } }));

// Rate limiting
app.use(rateLimiter);

// Health check (no auth required)
app.use('/health', healthRouter);

// Auth middleware for protected routes
app.use('/api/v1', authMiddleware);

// Dashboard stats routes (handled by gateway, not proxied)
app.use('/api/v1/dashboard', statsRouter);

// Setup proxies to microservices
setupProxies(app);

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    logger.error('Gateway Error:', {
        message: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
        body: req.body
    });
    res.status(err.statusCode || 500).json({
        success: false,
        error: { code: 'GATEWAY_ERROR', message: err.message }
    });
});

app.use(errorHandler);

// Start server
app.listen(config.port, () => {
    logger.info(`🚀 API Gateway running on port ${config.port}`);
    logger.info(`Environment: ${config.nodeEnv}`);
});

export default app;
