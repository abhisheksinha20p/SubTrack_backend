import { Request, Response } from 'express';
import axios from 'axios';
import crypto from 'crypto';
import { Webhook, WebhookLog } from '../models';
import { logger } from '../utils/logger';

export const webhookController = {
    // List webhooks
    async list(req: Request, res: Response) {
        try {
            const orgId = req.query.organizationId as string;

            const webhooks = await Webhook.find({ organizationId: orgId })
                .select('-secret')
                .sort({ createdAt: -1 })
                .lean();

            res.json({ success: true, data: webhooks });
        } catch (error) {
            logger.error('List webhooks error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch webhooks' },
            });
        }
    },

    // Create webhook
    async create(req: Request, res: Response) {
        try {
            const { organizationId, url, events } = req.body;

            const webhook = await Webhook.create({
                organizationId,
                url,
                events,
                isActive: true,
            });

            // Return secret only on creation
            res.status(201).json({
                success: true,
                data: {
                    ...webhook.toObject(),
                    secret: webhook.secret, // Only time we send the secret
                },
            });
        } catch (error) {
            logger.error('Create webhook error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to create webhook' },
            });
        }
    },

    // Update webhook
    async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const updates = req.body;

            const webhook = await Webhook.findByIdAndUpdate(
                id,
                { $set: updates },
                { new: true }
            ).select('-secret');

            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Webhook not found' },
                });
            }

            res.json({ success: true, data: webhook });
        } catch (error) {
            logger.error('Update webhook error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to update webhook' },
            });
        }
    },

    // Delete webhook
    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            await Webhook.findByIdAndDelete(id);
            res.json({ success: true, message: 'Webhook deleted' });
        } catch (error) {
            logger.error('Delete webhook error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to delete webhook' },
            });
        }
    },

    // Test webhook
    async test(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const webhook = await Webhook.findById(id);
            if (!webhook) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Webhook not found' },
                });
            }

            const testPayload = {
                event: 'test.ping',
                timestamp: new Date().toISOString(),
                data: { message: 'This is a test webhook delivery' },
            };

            const signature = crypto
                .createHmac('sha256', webhook.secret)
                .update(JSON.stringify(testPayload))
                .digest('hex');

            const startTime = Date.now();

            try {
                const response = await axios.post(webhook.url, testPayload, {
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Webhook-Signature': `sha256=${signature}`,
                    },
                    timeout: 10000,
                });

                res.json({
                    success: true,
                    data: {
                        delivered: true,
                        responseCode: response.status,
                        responseTime: Date.now() - startTime,
                    },
                });
            } catch (error: any) {
                res.json({
                    success: true,
                    data: {
                        delivered: false,
                        responseCode: error.response?.status || 0,
                        responseTime: Date.now() - startTime,
                        error: error.message,
                    },
                });
            }
        } catch (error) {
            logger.error('Test webhook error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to test webhook' },
            });
        }
    },
};

// Helper to deliver webhook
export const deliverWebhook = async (
    webhook: any,
    event: string,
    payload: any
) => {
    const fullPayload = {
        event,
        timestamp: new Date().toISOString(),
        data: payload,
    };

    const signature = crypto
        .createHmac('sha256', webhook.secret)
        .update(JSON.stringify(fullPayload))
        .digest('hex');

    try {
        const response = await axios.post(webhook.url, fullPayload, {
            headers: {
                'Content-Type': 'application/json',
                'X-Webhook-Signature': `sha256=${signature}`,
            },
            timeout: 10000,
        });

        await WebhookLog.create({
            webhookId: webhook._id,
            event,
            payload: fullPayload,
            responseCode: response.status,
            delivered: true,
        });

        // Update webhook last triggered
        await Webhook.findByIdAndUpdate(webhook._id, {
            lastTriggeredAt: new Date(),
            failureCount: 0,
        });

        return true;
    } catch (error: any) {
        await WebhookLog.create({
            webhookId: webhook._id,
            event,
            payload: fullPayload,
            responseCode: error.response?.status,
            responseBody: error.message,
            delivered: false,
        });

        // Increment failure count
        await Webhook.findByIdAndUpdate(webhook._id, {
            $inc: { failureCount: 1 },
        });

        return false;
    }
};
