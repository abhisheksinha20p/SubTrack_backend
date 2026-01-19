import { Request, Response } from 'express';
import slugify from 'slugify';
import { Organization, Member } from '../models';
import { publishEvent } from '../kafka';
import { logger } from '../utils/logger';

export const organizationController = {
    // List user's organizations
    async list(req: Request, res: Response) {
        try {
            const userId = req.headers['x-user-id'] as string;

            // Find all memberships for this user
            const memberships = await Member.find({ userId })
                .populate('organizationId')
                .sort({ createdAt: -1 })
                .lean();

            // Map to organization details with role
            const organizations = memberships.map((m: any) => {
                const org = m.organizationId;
                if (!org) return null;
                // Merge org details with the user's role in that org
                return {
                    ...org,
                    role: m.role, // Attach role here
                    joinedAt: m.createdAt
                };
            }).filter(Boolean);

            res.json({
                success: true,
                data: organizations,
            });
        } catch (error) {
            logger.error('List organizations error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch organizations' },
            });
        }
    },

    // Create organization
    async create(req: Request, res: Response) {
        try {
            const userId = req.headers['x-user-id'] as string;
            const { name, billingEmail, industry, size } = req.body;

            // Generate slug
            let slug = slugify(name, { lower: true, strict: true });

            // Check for existing slug and make unique
            const existing = await Organization.findOne({ slug });
            if (existing) {
                slug = `${slug}-${Date.now().toString(36)}`;
            }

            const organization = await Organization.create({
                name,
                slug,
                ownerId: userId,
                billingEmail: billingEmail || undefined,
                industry,
                size,
            });

            // Add owner as a member
            await Member.create({
                userId,
                organizationId: organization._id,
                email: req.headers['x-user-email'] || 'unknown@example.com', // Best effort if not passed
                role: 'owner',
                status: 'active',
            });

            // Publish event
            await publishEvent('user.events', 'org.created', {
                organizationId: organization._id.toString(),
                ownerId: userId,
                name: organization.name,
                slug: organization.slug,
            });

            logger.info(`Organization created: ${organization.slug}`);

            res.status(201).json({
                success: true,
                data: organization,
            });
        } catch (error) {
            logger.error('Create organization error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to create organization' },
            });
        }
    },

    // Get organization by ID
    async getById(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.headers['x-user-id'] as string;

            const organization = await Organization.findOne({
                _id: id,
                ownerId: userId,
            }).lean();

            if (!organization) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Organization not found' },
                });
            }

            res.json({
                success: true,
                data: organization,
            });
        } catch (error) {
            logger.error('Get organization error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch organization' },
            });
        }
    },

    // Update organization
    async update(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.headers['x-user-id'] as string;
            const updates = req.body;

            const organization = await Organization.findOneAndUpdate(
                { _id: id, ownerId: userId },
                { $set: updates },
                { new: true }
            );

            if (!organization) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Organization not found' },
                });
            }

            res.json({
                success: true,
                data: organization,
            });
        } catch (error) {
            logger.error('Update organization error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to update organization' },
            });
        }
    },

    // Delete organization
    async delete(req: Request, res: Response) {
        try {
            const { id } = req.params;
            const userId = req.headers['x-user-id'] as string;

            const organization = await Organization.findOneAndDelete({
                _id: id,
                ownerId: userId,
            });

            if (!organization) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Organization not found' },
                });
            }

            // Publish event
            await publishEvent('user.events', 'org.deleted', {
                organizationId: id,
                ownerId: userId,
            });

            res.json({
                success: true,
                message: 'Organization deleted',
            });
        } catch (error) {
            logger.error('Delete organization error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to delete organization' },
            });
        }
    },
};
