import { Request, Response } from 'express';
import { Member } from '../models';
import { publishEvent } from '../kafka';
import { logger } from '../utils/logger';

export const memberController = {
    // List organization members
    async list(req: Request, res: Response) {
        try {
            const { orgId } = req.params;
            const userId = req.headers['x-user-id'] as string;

            // TODO: Check if user has permission to view members

            const members = await Member.find({ organizationId: orgId })
                .sort({ createdAt: -1 })
                .lean();

            res.json({
                success: true,
                data: members,
            });
        } catch (error) {
            logger.error('List members error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to fetch members' },
            });
        }
    },

    // Invite member
    async invite(req: Request, res: Response) {
        try {
            const { orgId } = req.params;
            const userId = req.headers['x-user-id'] as string;
            const { email, role } = req.body;

            // Check for existing member
            const existing = await Member.findOne({
                organizationId: orgId,
                email: email.toLowerCase(),
            });

            if (existing) {
                return res.status(409).json({
                    success: false,
                    error: { code: 'CONFLICT', message: 'Member already exists' },
                });
            }

            const member = await Member.create({
                organizationId: orgId,
                userId: null, // Will be set when invite is accepted
                email: email.toLowerCase(),
                role: role || 'member',
                invitedBy: userId,
                invitedAt: new Date(),
                status: 'pending',
            });

            // Publish event for notification service
            await publishEvent('user.events', 'org.member_invited', {
                organizationId: orgId,
                inviteeEmail: email,
                invitedBy: userId,
                role: role || 'member',
            });

            logger.info(`Member invited: ${email} to org ${orgId}`);

            res.status(201).json({
                success: true,
                data: member,
            });
        } catch (error) {
            logger.error('Invite member error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to invite member' },
            });
        }
    },

    // Update member role
    async updateRole(req: Request, res: Response) {
        try {
            const { orgId, memberId } = req.params;
            const { role } = req.body;

            const member = await Member.findOneAndUpdate(
                { _id: memberId, organizationId: orgId },
                { $set: { role } },
                { new: true }
            );

            if (!member) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Member not found' },
                });
            }

            res.json({
                success: true,
                data: member,
            });
        } catch (error) {
            logger.error('Update member role error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to update member' },
            });
        }
    },

    // Remove member
    async remove(req: Request, res: Response) {
        try {
            const { orgId, memberId } = req.params;

            const member = await Member.findOneAndDelete({
                _id: memberId,
                organizationId: orgId,
            });

            if (!member) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Member not found' },
                });
            }

            // Publish event
            await publishEvent('user.events', 'org.member_removed', {
                organizationId: orgId,
                memberId,
                email: member.email,
            });

            res.json({
                success: true,
                message: 'Member removed',
            });
        } catch (error) {
            logger.error('Remove member error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Failed to remove member' },
            });
        }
    },
};
