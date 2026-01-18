import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { logger } from '../utils/logger';

// Routes that don't require authentication
const publicRoutes = [
    '/auth/login',
    '/auth/register',
    '/auth/refresh',
    '/auth/forgot-password',
    '/auth/reset-password',
    '/auth/verify-email',
];

export interface AuthRequest extends Request {
    user?: {
        id: string;
        email: string;
        roles: string[];
    };
}

export const authMiddleware = (req: AuthRequest, res: Response, next: NextFunction) => {
    // Check if route is public
    const isPublicRoute = publicRoutes.some(route => req.path.startsWith(route));
    if (isPublicRoute) {
        return next();
    }

    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'No token provided',
            },
        });
    }

    const token = authHeader.split(' ')[1];

    try {
        // Verify token
        const decoded = jwt.verify(token, config.jwtSecret) as {
            id: string;
            email: string;
            roles: string[];
        };

        req.user = decoded;

        // Add user info to headers for downstream services
        req.headers['x-user-id'] = decoded.id;
        req.headers['x-user-email'] = decoded.email;
        req.headers['x-user-roles'] = decoded.roles.join(',');

        next();
    } catch (error) {
        logger.warn('Invalid token:', error);
        return res.status(401).json({
            success: false,
            error: {
                code: 'UNAUTHORIZED',
                message: 'Invalid or expired token',
            },
        });
    }
};
