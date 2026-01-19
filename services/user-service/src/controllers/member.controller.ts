import { Request, Response } from 'express';
import { Member } from '../models';
import { publishEvent } from '../kafka';
import { logger } from '../utils/logger';

export const memberController = {
    // Helper: Check permission
    async checkPermission(userId: string, orgId: string, requiredRole: string[] = ['admin', 'owner']) {
        const member = await Member.findOne({ userId, organizationId: orgId });
        if (!member) return null;
        if (!requiredRole.includes(member.role)) return null;
        return member;
    },

    // List organization members
    async list(req: Request, res: Response) {
        try {
            const { orgId } = req.params;
            const userId = req.headers['x-user-id'] as string;

            // Check if user is a member of the org (any role)
            const requester = await Member.findOne({ userId, organizationId: orgId });
            if (!requester) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'You are not a member of this organization' },
                });
            }

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

            // RBAC: Only Admin/Owner can invite
            const requester = await Member.findOne({ userId, organizationId: orgId });
            if (!requester || !['owner', 'admin'].includes(requester.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Insufficient permissions to invite members' },
                });
            }

            // Cannot invite as Owner (Owner is unique)
            if (role === 'owner') {
                return res.status(400).json({
                    success: false,
                    error: { code: 'INVALID_ROLE', message: 'Cannot invite a user as Owner. Transfer ownership instead.' },
                });
            }

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
            const userId = req.headers['x-user-id'] as string;

            // RBAC: Only Admin/Owner can update roles
            const requester = await Member.findOne({ userId, organizationId: orgId });
            if (!requester || !['owner', 'admin'].includes(requester.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Insufficient permissions to update roles' },
                });
            }

            // Find target member
            const targetMember = await Member.findOne({ _id: memberId, organizationId: orgId });
            if (!targetMember) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Member not found' },
                });
            }

            // Hierarchy Protection:
            // 1. Cannot modify Owner's role
            if (targetMember.role === 'owner') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Cannot modify the Organization Owner' },
                });
            }

            // 2. Admin cannot update another Admin or promote to Owner
            if (requester.role === 'admin') {
                if (targetMember.role === 'admin' || role === 'admin' || role === 'owner') {
                    return res.status(403).json({
                        success: false,
                        error: { code: 'FORBIDDEN', message: 'Admins cannot manage other Admins or promote to Owner' },
                    });
                }
            }

            const member = await Member.findOneAndUpdate(
                { _id: memberId, organizationId: orgId },
                { $set: { role } },
                { new: true }
            );

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
            const userId = req.headers['x-user-id'] as string;

            // RBAC: Only Admin/Owner can remove members
            const requester = await Member.findOne({ userId, organizationId: orgId });
            if (!requester || !['owner', 'admin'].includes(requester.role)) {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Insufficient permissions to remove members' },
                });
            }

            // Find target member
            const targetMember = await Member.findOne({ _id: memberId, organizationId: orgId });
            if (!targetMember) {
                return res.status(404).json({
                    success: false,
                    error: { code: 'NOT_FOUND', message: 'Member not found' },
                });
            }

            // Hierarchy Protection:
            // 1. Cannot remove Owner
            if (targetMember.role === 'owner') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Cannot remove the Organization Owner' },
                });
            }

            // 2. Admin cannot remove another Admin
            if (requester.role === 'admin' && targetMember.role === 'admin') {
                return res.status(403).json({
                    success: false,
                    error: { code: 'FORBIDDEN', message: 'Admins cannot remove other Admins' },
                });
            }

            // 3. User removing themselves (handled by separate 'leave' endpoint usually, but check here)
            // If deleting self via this endpoint, ensure it's allowed (usually yes, unless owner)

            await Member.findByIdAndDelete(memberId);

            // Publish event
            await publishEvent('user.events', 'org.member_removed', {
                organizationId: orgId,
                memberId,
                email: targetMember.email,
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
