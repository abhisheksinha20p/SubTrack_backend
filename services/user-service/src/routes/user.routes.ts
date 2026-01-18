import { Router } from 'express';
import { organizationController } from '../controllers/organization.controller';
import { memberController } from '../controllers/member.controller';

export const userRouter = Router();

// Profile routes
userRouter.get('/profile', (req, res) => {
    const userId = req.headers['x-user-id'] as string;
    res.json({
        success: true,
        data: {
            id: userId,
            message: 'Profile endpoint - implement with user data from auth service cache',
        },
    });
});

userRouter.patch('/profile', (req, res) => {
    res.json({ success: true, message: 'Profile updated' });
});

// Organization routes
userRouter.get('/organizations', organizationController.list);
userRouter.post('/organizations', organizationController.create);
userRouter.get('/organizations/:id', organizationController.getById);
userRouter.patch('/organizations/:id', organizationController.update);
userRouter.delete('/organizations/:id', organizationController.delete);

// Member routes
userRouter.get('/organizations/:orgId/members', memberController.list);
userRouter.post('/organizations/:orgId/members', memberController.invite);
userRouter.patch('/organizations/:orgId/members/:memberId', memberController.updateRole);
userRouter.delete('/organizations/:orgId/members/:memberId', memberController.remove);
