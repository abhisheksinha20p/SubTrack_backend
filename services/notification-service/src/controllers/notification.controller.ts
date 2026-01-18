import { Request, Response } from 'express';
import { Notification } from '../models';
import { logger } from '../utils/logger';

export const notificationController = {
    // List notifications
    async list(req: Request, res: Response) {
        try {
            const userId = req.headers['x-user-id'] as string;
            const page = parseInt(req.query.page as string) || 1;
            const limit = parseInt(req.query.limit as string) || 20;
            const skip = (page - 1) * limit;

            const [notifications, total] = await Promise.all([
                Notification.find({ userId })
                    .sort({ createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Notification.countDocuments({ userId }),
            ]);

            res.json({
                success: true,
                data: {
                    items: notifications,
                    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
                },
            });
        } catch (error) {
            logger.error('List notifications error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch notifications' },
            });
        }
    },

    // Get unread count
    async getUnreadCount(req: Request, res: Response) {
        try {
            const userId = req.headers['x-user-id'] as string;
            const count = await Notification.countDocuments({ userId, readAt: null });

            res.json({
                success: true,
                data: { unreadCount: count },
            });
        } catch (error) {
            logger.error('Get unread count error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to get count' },
            });
        }
    },

    // Mark as read
    async markAsRead(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.headers['x-user-id'] as string;

            const notification = await Notification.findOneAndUpdate(
                { _id: id, userId },
                { $set: { readAt: new Date() } },
                { new: true }
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Notification not found' },
                });
            }

            res.json({ success: true, data: notification });
        } catch (error) {
            logger.error('Mark as read error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to update' },
            });
        }
    },

    // Mark all as read
    async markAllAsRead(req: Request, res: Response) {
        try {
            const userId = req.headers['x-user-id'] as string;

            await Notification.updateMany(
                { userId, readAt: null },
                { $set: { readAt: new Date() } }
            );

            res.json({ success: true, message: 'All notifications marked as read' });
        } catch (error) {
            logger.error('Mark all as read error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to update' },
            });
        }
    },

    // Delete notification
    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.headers['x-user-id'] as string;

            await Notification.findOneAndDelete({ _id: id, userId });

            res.json({ success: true, message: 'Notification deleted' });
        } catch (error) {
            logger.error('Delete notification error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to delete' },
            });
        }
    },
};
