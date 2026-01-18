import winston from 'winston';
import { config } from '../config';

export const logger = winston.createLogger({
    level: config.nodeEnv === 'development' ? 'debug' : 'info',
    format: winston.format.combine(
        winston.format.timestamp(),
        config.nodeEnv === 'development'
            ? winston.format.combine(winston.format.colorize(), winston.format.simple())
            : winston.format.json()
    ),
    defaultMeta: { service: 'notification-service' },
    transports: [new winston.transports.Console()],
});
