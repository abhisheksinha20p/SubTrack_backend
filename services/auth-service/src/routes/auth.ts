import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { validate } from '../middleware/validate';
import { registerSchema, loginSchema, refreshSchema, forgotPasswordSchema, resetPasswordSchema } from '../validators/auth.validator';

export const authRouter = Router();

// Registration
authRouter.post('/register', validate(registerSchema), authController.register);

// Login
authRouter.post('/login', validate(loginSchema), authController.login);

// Token refresh
authRouter.post('/refresh', validate(refreshSchema), authController.refresh);

// Logout
authRouter.post('/logout', authController.logout);

// Password reset
authRouter.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
authRouter.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);

// Email verification
authRouter.get('/verify-email', authController.verifyEmail);
