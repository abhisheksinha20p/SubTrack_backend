import { Request, Response } from 'express';
import Stripe from 'stripe';
import { Subscription, Plan, PaymentMethod } from '../models';
import { publishEvent } from '../kafka';
import { config } from '../config';
import { logger } from '../utils/logger';

const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });

export const subscriptionController = {
    // Get current subscription
    async get(req: Request, res: Response) {
        try {
            const orgId = req.headers['x-org-id'] as string || req.query.organizationId as string;

            const subscription = await Subscription.findOne({ organizationId: orgId })
                .populate('planId')
                .lean();

            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'No subscription found' },
                });
            }

            res.json({
                success: true,
                data: subscription,
            });
        } catch (error) {
            logger.error('Get subscription error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch subscription' },
            });
        }
    },

    // Create subscription
    async create(req: Request, res: Response) {
        try {
            const userId = req.headers['x-user-id'] as string;
            const { organizationId, planId, billingCycle, paymentMethodId } = req.body;

            const plan = await Plan.findById(planId);
            if (!plan) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Plan not found' },
                });
            }

            // Check for existing subscription
            const existing = await Subscription.findOne({ organizationId });
            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: { code: 'CONFLICT', message: 'Organization already has a subscription' },
                });
            }

            // Calculate period
            const now = new Date();
            const periodEnd = new Date(now);
            periodEnd.setMonth(periodEnd.getMonth() + (billingCycle === 'yearly' ? 12 : 1));

            // Create subscription (free plan doesn't need Stripe)
            const subscription = await Subscription.create({
                organizationId,
                planId,
                status: plan.pricing.monthly === 0 ? 'active' : 'active',
                billingCycle,
                currentPeriod: {
                    start: now,
                    end: periodEnd,
                },
            });

            // Publish event
            await publishEvent('billing.events', 'subscription.created', {
                subscriptionId: subscription._id.toString(),
                organizationId,
                planId,
                planName: plan.name,
                status: subscription.status,
                billingCycle,
            });

            logger.info(`Subscription created for org ${organizationId}`);

            res.status(201).json({
                success: true,
                data: subscription,
            });
        } catch (error) {
            logger.error('Create subscription error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to create subscription' },
            });
        }
    },

    // Change plan
    async changePlan(req: Request, res: Response) {
        try {
            const { organizationId, newPlanId } = req.body;

            const subscription = await Subscription.findOne({ organizationId });
            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Subscription not found' },
                });
            }

            const oldPlan = await Plan.findById(subscription.planId);
            const newPlan = await Plan.findById(newPlanId);

            if (!newPlan) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'New plan not found' },
                });
            }

            subscription.planId = newPlanId;
            await subscription.save();

            // Publish event
            await publishEvent('billing.events', 'subscription.upgraded', {
                subscriptionId: subscription._id.toString(),
                organizationId,
                oldPlan: { id: oldPlan?._id, name: oldPlan?.name },
                newPlan: { id: newPlan._id, name: newPlan.name },
            });

            res.json({
                success: true,
                data: subscription,
            });
        } catch (error) {
            logger.error('Change plan error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to change plan' },
            });
        }
    },

    // Cancel subscription
    async cancel(req: Request, res: Response) {
        try {
            const { organizationId, reason } = req.body;

            const subscription = await Subscription.findOne({ organizationId });
            if (!subscription) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Subscription not found' },
                });
            }

            subscription.cancelAtPeriodEnd = true;
            subscription.canceledAt = new Date();
            subscription.cancellationReason = reason;
            await subscription.save();

            // Publish event
            await publishEvent('billing.events', 'subscription.canceled', {
                subscriptionId: subscription._id.toString(),
                organizationId,
                cancelAt: subscription.currentPeriod.end.toISOString(),
                reason,
            });

            res.json({
                success: true,
                message: 'Subscription will be canceled at period end',
                data: subscription,
            });
        } catch (error) {
            logger.error('Cancel subscription error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to cancel subscription' },
            });
        }
    },

    // Get usage
    async getUsage(req: Request, res: Response) {
        try {
            const orgId = req.query.organizationId as string;

            // TODO: Implement actual usage tracking
            res.json({
                success: true,
                data: {
                    period: {
                        start: new Date(),
                        end: new Date(),
                    },
                    usage: {
                        users: { used: 5, limit: 10 },
                        projects: { used: 3, limit: 10 },
                        storage: { used: 256, limit: 1024, unit: 'MB' },
                        apiCalls: { used: 5000, limit: 10000 },
                    },
                },
            });
        } catch (error) {
            logger.error('Get usage error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch usage' },
            });
        }
    },

    // List payment methods
    async listPaymentMethods(req: Request, res: Response) {
        try {
            const orgId = req.query.organizationId as string;

            const methods = await PaymentMethod.find({ organizationId: orgId })
                .sort({ createdAt: -1 })
                .lean();

            res.json({
                success: true,
                data: methods,
            });
        } catch (error) {
            logger.error('List payment methods error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch payment methods' },
            });
        }
    },

    // Add payment method
    async addPaymentMethod(req: Request, res: Response) {
        try {
            const { organizationId, stripePaymentMethodId } = req.body;

            // Verify with Stripe
            const stripeMethod = await stripe.paymentMethods.retrieve(stripePaymentMethodId);

            const method = await PaymentMethod.create({
                organizationId,
                type: stripeMethod.type as 'card' | 'bank_account',
                card: stripeMethod.card ? {
                    brand: stripeMethod.card.brand,
                    lastFour: stripeMethod.card.last4,
                    expiryMonth: stripeMethod.card.exp_month,
                    expiryYear: stripeMethod.card.exp_year,
                } : undefined,
                isDefault: true,
                stripePaymentMethodId,
            });

            res.status(201).json({
                success: true,
                data: method,
            });
        } catch (error) {
            logger.error('Add payment method error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to add payment method' },
            });
        }
    },

    // Remove payment method
    async removePaymentMethod(req: Request, res: Response) {
        try {
            const { id } = req.params;

            await PaymentMethod.findByIdAndDelete(id);

            res.json({
                success: true,
                message: 'Payment method removed',
            });
        } catch (error) {
            logger.error('Remove payment method error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to remove payment method' },
            });
        }
    },

    // Handle Stripe webhook
    async handleStripeWebhook(req: Request, res: Response) {
        try {
            const sig = req.headers['stripe-signature'] as string;

            let event: Stripe.Event;
            try {
                event = stripe.webhooks.constructEvent(
                    req.body,
                    sig,
                    config.stripeWebhookSecret
                );
            } catch (err) {
                logger.error('Webhook signature verification failed');
                return res.status(400).json({ error: 'Invalid signature' });
            }

            // Handle different event types
            switch (event.type) {
                case 'invoice.paid':
                    const invoice = event.data.object as Stripe.Invoice;
                    await publishEvent('billing.events', 'invoice.paid', {
                        invoiceId: invoice.id,
                        amount: (invoice.amount_paid || 0) / 100,
                        paidAt: new Date().toISOString(),
                    });
                    break;

                case 'invoice.payment_failed':
                    const failedInvoice = event.data.object as Stripe.Invoice;
                    await publishEvent('billing.events', 'payment.failed', {
                        invoiceId: failedInvoice.id,
                        amount: (failedInvoice.amount_due || 0) / 100,
                        errorCode: 'payment_failed',
                    });
                    break;
            }

            res.json({ received: true });
        } catch (error) {
            logger.error('Stripe webhook error:', error);
            res.status(500).json({ error: 'Webhook handler failed' });
        }
    },
};
