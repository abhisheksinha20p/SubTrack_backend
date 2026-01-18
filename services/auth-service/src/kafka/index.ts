import { Kafka, Producer } from 'kafkajs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';

let producer: Producer | null = null;

export const connectKafka = async () => {
    try {
        const kafka = new Kafka({
            clientId: config.kafkaClientId,
            brokers: config.kafkaBrokers,
            retry: {
                initialRetryTime: 100,
                retries: 8,
            },
        });

        producer = kafka.producer();
        await producer.connect();

        logger.info('Kafka producer connected');
    } catch (error) {
        logger.warn('Kafka connection failed, events will not be published:', error);
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
        source: 'auth-service',
        correlationId: correlationId || uuidv4(),
        data,
    };

    try {
        await producer.send({
            topic,
            messages: [
                {
                    key: event.id,
                    value: JSON.stringify(event),
                },
            ],
        });

        logger.debug(`Event published: ${type} to ${topic}`);
    } catch (error) {
        logger.error(`Failed to publish event ${type}:`, error);
    }
};

export const disconnectKafka = async () => {
    if (producer) {
        await producer.disconnect();
        producer = null;
    }
};
