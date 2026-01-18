import { Kafka, Consumer } from 'kafkajs';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Notification, Webhook } from '../models';
import { deliverWebhook } from '../controllers/webhook.controller';
import { sendEmail } from '../services/email.service';

let consumer: Consumer | null = null;

export const connectKafka = async () => {
    try {
        const kafka = new Kafka({
            clientId: 'notification-service',
            brokers: config.kafkaBrokers,
            retry: { initialRetryTime: 100, retries: 8 },
        });

        consumer = kafka.consumer({ groupId: 'notification-service-group' });
        await consumer.connect();

        await consumer.subscribe({ topics: ['user.events', 'billing.events'], fromBeginning: false });

        await consumer.run({
            eachMessage: async ({ topic, message }) => {
                try {
                    const event = JSON.parse(message.value?.toString() || '{}');
                    await handleEvent(topic, event);
                } catch (error) {
                    logger.error('Error processing message:', error);
                }
            },
        });

        logger.info('Kafka consumer subscribed to user.events, billing.events');
    } catch (error) {
        logger.warn('Kafka connection failed:', error);
    }
};

const handleEvent = async (topic: string, event: any) => {
    const { type, data } = event;

    switch (type) {
        case 'user.registered':
            await sendEmail({
                to: data.email,
                subject: 'Welcome to SubTrack!',
                template: 'welcome',
                variables: {
                    firstName: data.firstName,
                    lastName: data.lastName,
                },
            });
            break;

        case 'org.member_invited':
            await Notification.create({
                userId: data.invitedBy,
                type: 'info',
                title: 'Member Invited',
                message: `You invited ${data.inviteeEmail} to join the organization`,
                channels: ['in_app'],
            });

            await sendEmail({
                to: data.inviteeEmail,
                subject: 'You\'ve been invited to join an organization',
                template: 'invite',
                variables: {
                    organizationName: data.organizationName,
                    role: data.role,
                },
            });
            break;

        case 'subscription.created':
            await triggerWebhooks(data.organizationId, 'subscription.created', data);
            break;

        case 'subscription.canceled':
            await triggerWebhooks(data.organizationId, 'subscription.canceled', data);
            break;

        case 'invoice.paid':
            await triggerWebhooks(data.organizationId, 'invoice.paid', data);
            break;

        case 'payment.failed':
            await triggerWebhooks(data.organizationId, 'payment.failed', data);
            break;

        default:
            logger.debug(`Unhandled event: ${type}`);
    }
};

const triggerWebhooks = async (organizationId: string, event: string, data: any) => {
    const webhooks = await Webhook.find({
        organizationId,
        isActive: true,
        events: event,
        failureCount: { $lt: 10 },
    });

    for (const webhook of webhooks) {
        await deliverWebhook(webhook, event, data);
    }
};

export const disconnectKafka = async () => {
    if (consumer) await consumer.disconnect();
};
