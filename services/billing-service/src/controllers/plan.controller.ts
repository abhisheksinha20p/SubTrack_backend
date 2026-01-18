import { Request, Response } from 'express';
import { Plan } from '../models';
import { logger } from '../utils/logger';

export const planController = {
    // List all active plans
    async list(req: Request, res: Response) {
        try {
            const plans = await Plan.find({ isActive: true })
                .sort({ sortOrder: 1 })
                .lean();

            res.json({
                success: true,
                data: plans,
            });
        } catch (error) {
            logger.error('List plans error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch plans' },
            });
        }
    },

    // Get plan by ID
    async getById(req: Request, res: Response) {
        try {
            const { id } = req.params;

            const plan = await Plan.findById(id).lean();

            if (!plan) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Plan not found' },
                });
            }

            res.json({
                success: true,
                data: plan,
            });
        } catch (error) {
            logger.error('Get plan error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch plan' },
            });
        }
    },
};
