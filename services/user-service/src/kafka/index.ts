import { Kafka, Producer, Consumer } from 'kafkajs';
import mongoose from 'mongoose';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { UserSettings } from '../models';

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export const connectKafka = async () => {
    try {
        const kafka = new Kafka({
            clientId: 'user-service',
            brokers: config.kafkaBrokers,
            retry: {
                initialRetryTime: 100,
                retries: 8,
            },
        });

        // Producer
        producer = kafka.producer();
        await producer.connect();
        logger.info('Kafka producer connected');

        // Consumer
        consumer = kafka.consumer({ groupId: 'user-service-group' });
        await consumer.connect();

        // Subscribe to user events for settings creation
        await consumer.subscribe({ topic: 'user.events', fromBeginning: false });

        await consumer.run({
            eachMessage: async ({ topic, partition, message }) => {
                try {
                    const event = JSON.parse(message.value?.toString() || '{}');
                    await handleEvent(event);
                } catch (error) {
                    logger.error('Error processing Kafka message:', error);
                }
            },
        });

        logger.info('Kafka consumer connected and subscribed');
    } catch (error) {
        logger.warn('Kafka connection failed:', error);
    }
};

const handleEvent = async (event: any) => {
    switch (event.type) {
        case 'user.registered':
            // Create default user settings when new user registers
            await UserSettings.create({
                userId: event.data.userId,
                notifications: {
                    email: true,
                    inApp: true,
                    billing: true,
                    marketing: false,
                },
                preferences: {
                    theme: 'system',
                    language: 'en',
                },
            });
            logger.info(`Created settings for user: ${event.data.userId}`);
            break;

        case 'user.updated':
            // Update member details in all organizations
            await mongoose.model('Member').updateMany(
                { userId: event.data.userId },
                {
                    $set: {
                        email: event.data.email,
                        firstName: event.data.firstName,
                        lastName: event.data.lastName,
                    }
                }
            );
            logger.info(`Updated member details for user: ${event.data.userId}`);
            break;

        default:
            logger.debug(`Unhandled event type: ${event.type}`);
    }
};

export const publishEvent = async <T>(
    topic: string,
    type: string,
    data: T,
    correlationId?: string
) => {
    if (!producer) {
        logger.warn(`Kafka not connected, skipping event: ${type}`);
        return;
    }

    const event = {
        id: uuidv4(),
        type,
        timestamp: new Date().toISOString(),
        source: 'user-service',
        correlationId: correlationId || uuidv4(),
        data,
    };

    try {
        await producer.send({
            topic,
            messages: [{ key: event.id, value: JSON.stringify(event) }],
        });
        logger.debug(`Event published: ${type}`);
    } catch (error) {
        logger.error(`Failed to publish event ${type}:`, error);
    }
};

export const disconnectKafka = async () => {
    if (consumer) await consumer.disconnect();
    if (producer) await producer.disconnect();
};
