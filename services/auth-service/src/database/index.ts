import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';

export const connectDatabase = async () => {
    try {
        await mongoose.connect(config.mongoUri);

        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });

        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });

        return mongoose.connection;
    } catch (error) {
        logger.error('Failed to connect to MongoDB:', error);
        throw error;
    }
};
