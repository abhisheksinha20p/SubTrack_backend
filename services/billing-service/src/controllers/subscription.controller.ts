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
            const { organizationId, planId, billingCycle } = req.body;

            const plan = await Plan.findById(planId);
            if (!plan) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Plan not found' },
                });
            }

            // Check for existing subscription
            const existing = await Subscription.findOne({ organizationId }).populate('planId');
            if (existing && existing.status === 'active') {
                const existingPlan = existing.planId as any;
                // Allow upgrading from free plan (price 0) to paid plan
                // If existing plan is paid (price > 0), block and require changePlan/cancel
                if (existingPlan && existingPlan.pricing && existingPlan.pricing.monthly > 0) {
                    return res.status(409).json({
                        success: false,
                        error: { code: 'CONFLICT', message: 'Organization already has an active paid subscription. Please change plan instead.' },
                    });
                }
                // If existing is free, we proceed to create new session/subscription which will overwrite on success
            }

            // If plan is free, create immediately
            if (plan.pricing.monthly === 0) {
                const now = new Date();
                const periodEnd = new Date(now);
                periodEnd.setMonth(periodEnd.getMonth() + 1);

                const subscription = await Subscription.create({
                    organizationId,
                    planId,
                    status: 'active',
                    billingCycle: 'monthly',
                    currentPeriod: { start: now, end: periodEnd },
                });

                await publishEvent('billing.events', 'subscription.created', {
                    subscriptionId: subscription._id.toString(),
                    organizationId,
                    planId,
                    planName: plan.name,
                    status: 'active',
                });

                return res.json({ success: true, data: subscription });
            }

            // If Paid Plan -> Create Stripe Checkout Session
            // 1. Get or create customer
            let customerId: string;
            // Check if we already have a subscription record (even cancelled/unpaid) to get customer ID
            let subscription = await Subscription.findOne({ organizationId });

            if (subscription?.stripeCustomerId) {
                customerId = subscription.stripeCustomerId;
            } else {
                const customer = await stripe.customers.create({
                    metadata: { organizationId },
                    email: req.headers['x-user-email'] as string, // Improve: Pass email if available
                });
                customerId = customer.id;
            }

            // 2. Create/Update local subscription as 'unpaid'/'incomplete' to store customer ID
            if (!subscription) {
                subscription = await Subscription.create({
                    organizationId,
                    planId,
                    status: 'unpaid',
                    billingCycle,
                    currentPeriod: { start: new Date(), end: new Date() },
                    stripeCustomerId: customerId,
                });
            } else {
                // Update existing record with new details and customer ID if missing
                subscription.planId = planId;
                subscription.billingCycle = billingCycle;
                subscription.stripeCustomerId = customerId; // Ensure customer ID is saved
                // Don't change status if it was active, but here we are likely upgrading/creating new
                await subscription.save();
            }

            // 3. Create Checkout Session
            const priceAmount = billingCycle === 'yearly' ? plan.pricing.yearly : plan.pricing.monthly;

            const session = await stripe.checkout.sessions.create({
                customer: customerId,
                mode: 'subscription',
                payment_method_types: ['card'],
                line_items: [
                    {
                        price_data: {
                            currency: 'usd',
                            product_data: {
                                name: `${plan.name} (${billingCycle})`,
                                metadata: { planId: plan._id.toString() }
                            },
                            unit_amount: Math.round(priceAmount * 100), // in cents
                            recurring: {
                                interval: billingCycle === 'yearly' ? 'year' : 'month',
                            },
                        },
                        quantity: 1,
                    },
                ],
                metadata: {
                    organizationId,
                    planId: planId.toString(),
                    billingCycle,
                },
                subscription_data: {
                    metadata: {
                        organizationId,
                        planId: planId.toString(),
                        billingCycle,
                    }
                },
                success_url: `${req.headers.origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
                cancel_url: `${req.headers.origin}/billing?canceled=true`,
            });

            res.json({
                success: true,
                checkoutUrl: session.url,
            });

        } catch (error) {
            logger.error('Create subscription error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to initiate subscription' },
            });
        }
    },

    // Sync subscription with Stripe (for localhost/manual updates)
    async sync(req: Request, res: Response) {
        try {
            const orgId = req.headers['x-org-id'] as string || req.body.organizationId;
            if (!orgId) {
                return res.status(400).json({ success: false, error: 'Organization ID required' });
            }

            const subscription = await Subscription.findOne({ organizationId: orgId });
            if (!subscription || !subscription.stripeCustomerId) {
                return res.status(404).json({ success: false, message: 'No Stripe customer found to sync' });
            }

            // List recent subscriptions for customer
            const subscriptions = await stripe.subscriptions.list({
                customer: subscription.stripeCustomerId,
                limit: 1,
                status: 'all', // Include active, trailing, etc.
            });

            if (subscriptions.data.length > 0) {
                const stripeSub = subscriptions.data[0];
                const status = stripeSub.status as any; // Map status if needed

                // Update local DB
                subscription.status = status === 'active' || status === 'trialing' ? 'active' : 'unpaid'; // Simplified mapping
                subscription.stripeSubscriptionId = stripeSub.id;
                subscription.currentPeriod = {
                    start: new Date(stripeSub.current_period_start * 1000),
                    end: new Date(stripeSub.current_period_end * 1000),
                };

                // 1. Try to match plan based on metadata
                if (stripeSub.metadata?.planId) {
                    subscription.planId = stripeSub.metadata.planId as any;
                }
                // 2. If no metadata, fallback to matching by Amount/Price
                else if (stripeSub.items.data.length > 0) {
                    const priceAmount = stripeSub.items.data[0].price.unit_amount; // in cents
                    if (priceAmount !== null) {
                        // Find plan with this price
                        // Assuming monthly for simplicity or checking interval
                        const interval = stripeSub.items.data[0].price.recurring?.interval;

                        const matchedPlan = await Plan.findOne({
                            $or: [
                                { 'pricing.monthly': priceAmount / 100 },
                                { 'pricing.yearly': priceAmount / 100 }
                            ]
                        });

                        if (matchedPlan) {
                            subscription.planId = matchedPlan._id;
                            subscription.billingCycle = interval === 'year' ? 'yearly' : 'monthly';
                        }
                    }
                }

                await subscription.save();

                return res.json({
                    success: true,
                    data: subscription,
                    message: 'Synced with Stripe'
                });
            }

            res.json({ success: true, message: 'No active subscriptions found on Stripe', data: subscription });

        } catch (error) {
            logger.error('Sync error:', error);
            res.status(500).json({ success: false, error: 'Failed to sync' });
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

            // If new plan is free (price = 0), just update database
            const newPlanPrice = newPlan.pricing?.monthly || 0;
            const oldPlanPrice = oldPlan?.pricing?.monthly || 0;

            if (newPlanPrice === 0) {
                // Downgrading to free - cancel Stripe subscription if exists
                if (subscription.stripeSubscriptionId) {
                    try {
                        await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
                    } catch (e) {
                        logger.warn('Could not cancel Stripe subscription:', e);
                    }
                }
                subscription.planId = newPlanId;
                subscription.stripeSubscriptionId = undefined;
                subscription.status = 'active';
                await subscription.save();

                return res.json({
                    success: true,
                    data: subscription,
                    message: 'Downgraded to free plan',
                });
            }

            // If upgrading to paid plan and no Stripe subscription exists, create checkout
            if (!subscription.stripeSubscriptionId) {
                // Need to create a new checkout session
                const priceId = newPlan.stripePriceId?.monthly;
                if (!priceId) {
                    return res.status(400).json({
                        success: false,
                        error: { code: 'NO_PRICE', message: 'Plan has no Stripe price configured' },
                    });
                }

                const session = await stripe.checkout.sessions.create({
                    customer: subscription.stripeCustomerId,
                    mode: 'subscription',
                    line_items: [{ price: priceId, quantity: 1 }],
                    metadata: { organizationId, planId: newPlanId.toString() },
                    subscription_data: {
                        metadata: { organizationId, planId: newPlanId.toString() },
                    },
                    success_url: `${req.headers.origin}/billing?success=true&session_id={CHECKOUT_SESSION_ID}`,
                    cancel_url: `${req.headers.origin}/billing?canceled=true`,
                });

                return res.json({
                    success: true,
                    checkoutUrl: session.url,
                });
            }

            // Update existing Stripe subscription with new price
            const newPriceId = newPlan.stripePriceId?.monthly;
            if (!newPriceId) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'NO_PRICE', message: 'New plan has no Stripe price configured' },
                });
            }

            // Get current subscription to find the item to update
            const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
            const subscriptionItemId = stripeSub.items.data[0]?.id;

            if (!subscriptionItemId) {
                return res.status(500).json({
                    success: false,
                    error: { code: 'STRIPE_ERROR', message: 'Could not find subscription item' },
                });
            }

            // Update the subscription with new price (Stripe handles proration automatically)
            const updatedStripeSub = await stripe.subscriptions.update(subscription.stripeSubscriptionId, {
                items: [{
                    id: subscriptionItemId,
                    price: newPriceId,
                }],
                proration_behavior: 'create_prorations', // Charge/credit difference
                metadata: { planId: newPlanId.toString() },
            });

            // Update local database
            subscription.planId = newPlanId;
            subscription.currentPeriod = {
                start: new Date(updatedStripeSub.current_period_start * 1000),
                end: new Date(updatedStripeSub.current_period_end * 1000),
            };
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
                message: `Plan changed from ${oldPlan?.name} to ${newPlan.name}`,
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
                        users: { used: 1, limit: 10 },
                        projects: { used: 1, limit: 10 },
                        storage: { used: 80, limit: 1024, unit: 'MB' }, // 80MB
                        apiCalls: { used: 100, limit: 10000 },
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
                case 'checkout.session.completed':
                    const session = event.data.object as Stripe.Checkout.Session;
                    if (session.mode === 'subscription' && session.metadata) {
                        const { organizationId, planId, billingCycle } = session.metadata;
                        const subscriptionId = session.subscription as string;
                        const customerId = session.customer as string;

                        // Retrieve full subscription details from Stripe
                        const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);

                        // Update or Create local subscription
                        await Subscription.findOneAndUpdate(
                            { organizationId },
                            {
                                organizationId,
                                planId,
                                status: 'active',
                                billingCycle,
                                stripeCustomerId: customerId,
                                stripeSubscriptionId: subscriptionId,
                                currentPeriod: {
                                    start: new Date(stripeSub.current_period_start * 1000),
                                    end: new Date(stripeSub.current_period_end * 1000),
                                },
                            },
                            { upsert: true, new: true }
                        );

                        await publishEvent('billing.events', 'subscription.created', {
                            organizationId,
                            planId,
                            status: 'active',
                            stripeSubscriptionId: subscriptionId
                        });
                        logger.info(`Subscription activated for org ${organizationId}`);
                    }
                    break;

                case 'customer.subscription.updated':
                case 'customer.subscription.deleted':
                    const sub = event.data.object as Stripe.Subscription;
                    const status = sub.status === 'active' ? 'active' : 'canceled'; // Simplified mapping

                    // Find by stripe ID
                    await Subscription.findOneAndUpdate(
                        { stripeSubscriptionId: sub.id },
                        {
                            status: sub.status,
                            currentPeriod: {
                                start: new Date(sub.current_period_start * 1000),
                                end: new Date(sub.current_period_end * 1000),
                            }
                        }
                    );
                    break;

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
