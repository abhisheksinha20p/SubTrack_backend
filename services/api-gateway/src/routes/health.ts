import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';

export const healthRouter = Router();

interface ServiceHealth {
    status: 'up' | 'down';
    latency?: number;
}

const checkService = async (name: string, url: string): Promise<ServiceHealth> => {
    const start = Date.now();
    try {
        await axios.get(`${url}/health`, { timeout: 5000 });
        return { status: 'up', latency: Date.now() - start };
    } catch {
        return { status: 'down' };
    }
};

healthRouter.get('/', async (req: Request, res: Response) => {
    const services: Record<string, ServiceHealth> = {};

    const checks = await Promise.all([
        checkService('auth', config.services.auth).then(h => services.auth = h),
        checkService('user', config.services.user).then(h => services.user = h),
        checkService('billing', config.services.billing).then(h => services.billing = h),
        checkService('notification', config.services.notification).then(h => services.notification = h),
    ]);

    const allHealthy = Object.values(services).every(s => s.status === 'up');

    res.status(allHealthy ? 200 : 503).json({
        status: allHealthy ? 'healthy' : 'degraded',
        timestamp: new Date().toISOString(),
        services,
    });
});
