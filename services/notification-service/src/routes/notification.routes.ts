import { Router } from 'express';
import { notificationController } from '../controllers/notification.controller';
import { webhookController } from '../controllers/webhook.controller';

export const notificationRouter = Router();

// Notifications
notificationRouter.get('/', notificationController.list);
notificationRouter.get('/unread-count', notificationController.getUnreadCount);
notificationRouter.patch('/:id/read', notificationController.markAsRead);
notificationRouter.post('/mark-all-read', notificationController.markAllAsRead);
notificationRouter.delete('/:id', notificationController.delete);

// Webhooks
export const webhookRouter = Router();
webhookRouter.get('/', webhookController.list);
webhookRouter.post('/', webhookController.create);
webhookRouter.patch('/:id', webhookController.update);
webhookRouter.delete('/:id', webhookController.delete);
webhookRouter.post('/:id/test', webhookController.test);
