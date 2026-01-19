import { Router } from 'express';
import { planController } from '../controllers/plan.controller';
import { subscriptionController } from '../controllers/subscription.controller';
import { invoiceController } from '../controllers/invoice.controller';

export const billingRouter = Router();

// Plans (public)
billingRouter.get('/plans', planController.list);
billingRouter.get('/plans/:id', planController.getById);

// Subscriptions
billingRouter.get('/subscriptions', subscriptionController.get);
billingRouter.post('/subscriptions/sync', subscriptionController.sync);
billingRouter.post('/subscriptions', subscriptionController.create);
billingRouter.post('/subscriptions/change', subscriptionController.changePlan);
billingRouter.post('/subscriptions/cancel', subscriptionController.cancel);
billingRouter.get('/subscriptions/usage', subscriptionController.getUsage);

// Invoices
billingRouter.get('/invoices', invoiceController.list);
billingRouter.get('/invoices/:id', invoiceController.getById);
billingRouter.get('/invoices/:id/pdf', invoiceController.downloadPdf);

// Payment methods
billingRouter.get('/payment-methods', subscriptionController.listPaymentMethods);
billingRouter.post('/payment-methods', subscriptionController.addPaymentMethod);
billingRouter.delete('/payment-methods/:id', subscriptionController.removePaymentMethod);

// Stripe webhook
billingRouter.post('/webhooks/stripe', subscriptionController.handleStripeWebhook);
