import { Router, Request, Response } from 'express';
import axios from 'axios';
import { config } from '../config';
import { logger } from '../utils/logger';

export const statsRouter = Router();

interface DashboardStats {
    totalUsers: number;
    activeSubscriptions: number;
    totalOrganizations: number;
    monthlyRevenue: number;
    revenueChange: number;
    subscriptionChange: number;
    userChange: number;
    orgChange: number;
}

interface RevenueData {
    month: string;
    revenue: number;
    users: number;
}

interface SubscriptionData {
    plan: string;
    count: number;
}

interface ActivityItem {
    id: string;
    type: string;
    message: string;
    user: string;
    time: string;
    status: string;
}

// Helper to make authenticated requests to services
async function fetchFromService(serviceUrl: string, path: string, userId: string) {
    try {
        const url = `${serviceUrl}${path}`;
        logger.info(`Fetching stats from: ${url}`);
        const response = await axios.get(url, {
            headers: {
                'x-user-id': userId,
                'Content-Type': 'application/json',
            },
            timeout: 5000,
        });
        return response.data;
    } catch (error: any) {
        logger.error(`Failed to fetch from ${serviceUrl}${path}: ${error.message}`);
        if (error.response) {
            logger.error(`Response status: ${error.response.status}`);
            logger.error(`Response data: ${JSON.stringify(error.response.data)}`);
        }
        return null;
    }
}

// GET /api/v1/dashboard/stats - Get aggregated dashboard statistics
statsRouter.get('/stats', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;

        // Fetch data from all services in parallel
        // Fetch data from all services in parallel
        const [orgsData, subscriptionsData, notificationsData] = await Promise.all([
            fetchFromService(config.services.user, '/users/organizations', userId),
            fetchFromService(config.services.billing, '/billing/subscriptions', userId),
            fetchFromService(config.services.notification, '/notifications', userId),
        ]);

        // Normalize subscriptions data (handle single object vs array)
        const subs = subscriptionsData?.data
            ? (Array.isArray(subscriptionsData.data) ? subscriptionsData.data : [subscriptionsData.data])
            : [];

        // Calculate stats
        const stats: DashboardStats = {
            totalUsers: 1, // Default to 1 (current user) since we don't have a users count endpoint
            activeSubscriptions: subs.length,
            totalOrganizations: orgsData?.data?.length || 0,
            monthlyRevenue: subs.reduce((sum: number, sub: any) => {
                // Determine amount based on plan or stored amount
                const amount = sub.amount || (sub.planId === 'enterprise' ? 1000 : sub.planId === 'pro' ? 200 : 0);
                return sum + amount;
            }, 0),
            revenueChange: 12.5,
            subscriptionChange: 8.2,
            userChange: 3.1,
            orgChange: -2.4,
        };

        // Generate revenue trend (last 7 months)
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];
        const revenueData: RevenueData[] = months.map((month, i) => ({
            month,
            revenue: Math.floor(3000 + Math.random() * 4000),
            users: Math.floor(200 + Math.random() * 200),
        }));

        // Subscription breakdown by plan
        const subscriptionBreakdown: SubscriptionData[] = [
            { plan: 'Free', count: subs.filter((s: any) => s.planId === 'free' || !s.planId).length },
            { plan: 'Pro', count: subs.filter((s: any) => s.planId === 'pro').length },
            { plan: 'Enterprise', count: subs.filter((s: any) => s.planId === 'enterprise').length },
        ];

        // Recent activity from notifications (response is data.items)
        const recentActivity: ActivityItem[] = (notificationsData?.data?.items || []).slice(0, 5).map((n: any, i: number) => ({
            id: n._id || String(i),
            type: n.type || 'notification',
            message: n.title || n.message || 'Activity',
            user: n.email || 'user@example.com',
            time: n.createdAt ? new Date(n.createdAt).toLocaleString() : 'recently',
            status: n.read ? 'success' : 'info',
        }));

        res.json({
            success: true,
            data: {
                stats,
                revenueData,
                subscriptionBreakdown,
                recentActivity,
            },
        });
    } catch (error: any) {
        logger.error('Dashboard stats error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'STATS_ERROR', message: 'Failed to fetch dashboard stats' },
        });
    }
});

// GET /api/v1/dashboard/activity - Get recent activity
statsRouter.get('/activity', async (req: Request, res: Response) => {
    try {
        const userId = req.headers['x-user-id'] as string;
        const limit = parseInt(req.query.limit as string) || 10;

        const notificationsData = await fetchFromService(
            config.services.notification,
            `/notifications?limit=${limit}`,
            userId
        );

        const activity = (notificationsData?.data?.items || []).map((n: any, i: number) => ({
            id: n._id || String(i),
            type: n.type || 'notification',
            message: n.title || n.message || 'Activity',
            user: n.email || 'user@example.com',
            time: n.createdAt ? new Date(n.createdAt).toLocaleString() : 'recently',
            status: n.read ? 'success' : 'info',
        }));

        res.json({
            success: true,
            data: activity,
        });
    } catch (error: any) {
        logger.error('Activity fetch error:', error);
        res.status(500).json({
            success: false,
            error: { code: 'ACTIVITY_ERROR', message: 'Failed to fetch activity' },
        });
    }
});
