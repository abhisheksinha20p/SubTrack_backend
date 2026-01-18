import { Plan } from '../models';
import { logger } from '../utils/logger';

const defaultPlans = [
    {
        name: 'Free',
        slug: 'free',
        description: 'Perfect for getting started',
        pricing: { monthly: 0, yearly: 0, currency: 'USD' },
        features: [
            { name: 'Up to 3 users', included: true, limit: 3 },
            { name: '1 project', included: true, limit: 1 },
            { name: '100 MB storage', included: true },
            { name: 'Email support', included: true },
            { name: 'API access', included: false },
        ],
        limits: { users: 3, projects: 1, storage: 100, apiCalls: 1000 },
        isActive: true,
        isPopular: false,
        sortOrder: 0,
    },
    {
        name: 'Pro',
        slug: 'pro',
        description: 'For growing teams',
        pricing: { monthly: 29, yearly: 290, currency: 'USD' },
        features: [
            { name: 'Up to 10 users', included: true, limit: 10 },
            { name: 'Unlimited projects', included: true },
            { name: '10 GB storage', included: true },
            { name: 'Priority support', included: true },
            { name: 'API access', included: true },
            { name: 'Advanced analytics', included: true },
        ],
        limits: { users: 10, projects: -1, storage: 10240, apiCalls: 50000 },
        isActive: true,
        isPopular: true,
        sortOrder: 1,
    },
    {
        name: 'Enterprise',
        slug: 'enterprise',
        description: 'For large organizations',
        pricing: { monthly: 99, yearly: 990, currency: 'USD' },
        features: [
            { name: 'Unlimited users', included: true },
            { name: 'Unlimited projects', included: true },
            { name: '100 GB storage', included: true },
            { name: 'Dedicated support', included: true },
            { name: 'API access', included: true },
            { name: 'Advanced analytics', included: true },
            { name: 'SSO', included: true },
            { name: 'Audit logs', included: true },
        ],
        limits: { users: -1, projects: -1, storage: 102400, apiCalls: -1 },
        isActive: true,
        isPopular: false,
        sortOrder: 2,
    },
];

export const seedPlans = async () => {
    try {
        for (const planData of defaultPlans) {
            const exists = await Plan.findOne({ slug: planData.slug });
            if (!exists) {
                await Plan.create(planData);
                logger.info(`Seeded plan: ${planData.name}`);
            }
        }
        logger.info('Plans seeded successfully');
    } catch (error) {
        logger.error('Failed to seed plans:', error);
    }
};
