import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { User } from '../models/user.model';
import { RefreshToken } from '../models/refreshToken.model';
import { config } from '../config';
import { publishEvent } from '../kafka';
import { logger } from '../utils/logger';

export const authController = {
    // Register new user
    async register(req: Request, res: Response) {
        try {
            const { email, password, firstName, lastName } = req.body;

            // Check if user exists
            const existingUser = await User.findOne({ email });
            if (existingUser) {
                return res.status(409).json({
                    success: false,
                    error: {
                        code: 'CONFLICT',
                        message: 'Email already registered',
                    },
                });
            }

            // Create user
            const user = new User({
                email,
                passwordHash: password, // Will be hashed by pre-save hook
                firstName,
                lastName,
                emailVerificationToken: crypto.randomBytes(32).toString('hex'),
            });

            await user.save();

            // Publish event
            await publishEvent('user.events', 'user.registered', {
                userId: user._id.toString(),
                email: user.email,
                firstName: user.firstName,
                lastName: user.lastName,
            });

            logger.info(`User registered: ${user.email}`);

            res.status(201).json({
                success: true,
                message: 'Registration successful. Please verify your email.',
                data: {
                    userId: user._id,
                    email: user.email,
                },
            });
        } catch (error) {
            logger.error('Register error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Registration failed' },
            });
        }
    },

    // Login
    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;

            // Find user
            const user = await User.findOne({ email });
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
                });
            }

            // Check password
            const isValid = await user.comparePassword(password);
            if (!isValid) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Invalid credentials' },
                });
            }

            // Generate tokens
            const accessToken = jwt.sign(
                { id: user._id, email: user.email, roles: user.roles },
                config.jwtSecret,
                { expiresIn: config.jwtAccessExpiry }
            );

            const refreshToken = uuidv4();
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

            // Save refresh token
            await RefreshToken.create({
                userId: user._id,
                tokenHash: crypto.createHash('sha256').update(refreshToken).digest('hex'),
                expiresAt,
                deviceInfo: {
                    userAgent: req.headers['user-agent'],
                    ip: req.ip,
                },
            });

            // Update last login
            user.lastLoginAt = new Date();
            await user.save();

            // Publish event
            await publishEvent('user.events', 'user.login', {
                userId: user._id.toString(),
                ip: req.ip,
                userAgent: req.headers['user-agent'],
                isNewDevice: true, // TODO: Check device history
            });

            res.json({
                success: true,
                data: {
                    accessToken,
                    refreshToken,
                    expiresIn: 900, // 15 minutes in seconds
                    user: {
                        id: user._id,
                        email: user.email,
                        firstName: user.firstName,
                        lastName: user.lastName,
                        roles: user.roles,
                    },
                },
            });
        } catch (error) {
            logger.error('Login error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Login failed' },
            });
        }
    },

    // Refresh token
    async refresh(req: Request, res: Response) {
        try {
            const { refreshToken } = req.body;

            const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
            const storedToken = await RefreshToken.findOne({
                tokenHash,
                revokedAt: null,
                expiresAt: { $gt: new Date() },
            });

            if (!storedToken) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' },
                });
            }

            const user = await User.findById(storedToken.userId);
            if (!user) {
                return res.status(401).json({
                    success: false,
                    error: { code: 'UNAUTHORIZED', message: 'User not found' },
                });
            }

            // Generate new access token
            const accessToken = jwt.sign(
                { id: user._id, email: user.email, roles: user.roles },
                config.jwtSecret,
                { expiresIn: config.jwtAccessExpiry }
            );

            res.json({
                success: true,
                data: {
                    accessToken,
                    expiresIn: 900,
                },
            });
        } catch (error) {
            logger.error('Refresh error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Token refresh failed' },
            });
        }
    },

    // Logout
    async logout(req: Request, res: Response) {
        try {
            const authHeader = req.headers.authorization;
            if (authHeader) {
                // Optionally: Add token to blacklist in Redis
            }

            res.json({
                success: true,
                message: 'Logged out successfully',
            });
        } catch (error) {
            logger.error('Logout error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Logout failed' },
            });
        }
    },

    // Forgot password
    async forgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;

            // Always return success (security: don't reveal if email exists)
            logger.info(`Password reset requested for: ${email}`);

            res.json({
                success: true,
                message: 'If this email exists, a reset link has been sent.',
            });
        } catch (error) {
            logger.error('Forgot password error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Request failed' },
            });
        }
    },

    // Reset password
    async resetPassword(req: Request, res: Response) {
        try {
            const { token, password } = req.body;

            // TODO: Validate token and update password

            res.json({
                success: true,
                message: 'Password reset successful',
            });
        } catch (error) {
            logger.error('Reset password error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Password reset failed' },
            });
        }
    },

    // Verify email
    async verifyEmail(req: Request, res: Response) {
        try {
            const { token } = req.query;

            if (!token) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Token required' },
                });
            }

            const user = await User.findOne({ emailVerificationToken: token });
            if (!user) {
                return res.status(400).json({
                    success: false,
                    error: { code: 'VALIDATION_ERROR', message: 'Invalid token' },
                });
            }

            user.emailVerified = true;
            user.emailVerificationToken = undefined;
            await user.save();

            res.json({
                success: true,
                message: 'Email verified successfully',
            });
        } catch (error) {
            logger.error('Verify email error:', error);
            res.status(500).json({
                success: false,
                error: { code: 'INTERNAL_ERROR', message: 'Verification failed' },
            });
        }
    },
};
