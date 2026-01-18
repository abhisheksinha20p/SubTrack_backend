import { Kafka, Producer, Consumer } from 'kafkajs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { v4 as uuidv4 } from 'uuid';
import { Subscription, Plan } from '../models';

let producer: Producer | null = null;
let consumer: Consumer | null = null;

export const connectKafka = async () => {
    try {
        const kafka = new Kafka({
            clientId: 'billing-service',
            brokers: config.kafkaBrokers,
            retry: { initialRetryTime: 100, retries: 8 },
        });

        producer = kafka.producer();
        await producer.connect();
        logger.info('Kafka producer connected');

        consumer = kafka.consumer({ groupId: 'billing-service-group' });
        await consumer.connect();

        await consumer.subscribe({ topic: 'user.events', fromBeginning: false });

        await consumer.run({
            eachMessage: async ({ message }) => {
                try {
                    const event = JSON.parse(message.value?.toString() || '{}');
                    await handleEvent(event);
                } catch (error) {
                    logger.error('Error processing message:', error);
                }
            },
        });

        logger.info('Kafka consumer subscribed to user.events');
    } catch (error) {
        logger.warn('Kafka connection failed:', error);
    }
};

const handleEvent = async (event: any) => {
    switch (event.type) {
        case 'org.created':
            // Create free subscription for new org
            const freePlan = await Plan.findOne({ slug: 'free' });
            if (freePlan) {
                const now = new Date();
                const periodEnd = new Date(now);
                periodEnd.setMonth(periodEnd.getMonth() + 1);

                await Subscription.create({
                    organizationId: event.data.organizationId,
                    planId: freePlan._id,
                    status: 'active',
                    billingCycle: 'monthly',
                    currentPeriod: { start: now, end: periodEnd },
                });

                logger.info(`Created free subscription for org: ${event.data.organizationId}`);

                await publishEvent('billing.events', 'subscription.created', {
                    subscriptionId: 'auto',
                    organizationId: event.data.organizationId,
                    planId: freePlan._id.toString(),
                    planName: freePlan.name,
                    status: 'active',
                });
            }
            break;
    }
};

export const publishEvent = async <T>(topic: string, type: string, data: T) => {
    if (!producer) {
        logger.warn(`Kafka not connected, skipping: ${type}`);
        return;
    }

    const event = {
        id: uuidv4(),
        type,
        timestamp: new Date().toISOString(),
        source: 'billing-service',
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
