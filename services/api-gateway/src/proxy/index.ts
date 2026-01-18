import { Express } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { config } from '../config';
import { logger } from '../utils/logger';

interface ProxyConfig {
    path: string;
    target: string;
    pathRewrite?: Record<string, string>;
}

const proxyConfigs: ProxyConfig[] = [
    {
        path: '/api/v1/auth',
        target: config.services.auth,
        pathRewrite: { '^/api/v1/auth': '/auth' },
    },
    {
        path: '/api/v1/users',
        target: config.services.user,
        pathRewrite: { '^/api/v1/users': '/users' },
    },
    {
        path: '/api/v1/billing',
        target: config.services.billing,
        pathRewrite: { '^/api/v1/billing': '/billing' },
    },
    {
        path: '/api/v1/notifications',
        target: config.services.notification,
        pathRewrite: { '^/api/v1/notifications': '/notifications' },
    },
    {
        path: '/api/v1/webhooks',
        target: config.services.notification,
        pathRewrite: { '^/api/v1/webhooks': '/webhooks' },
    },
];

export const setupProxies = (app: Express) => {
    proxyConfigs.forEach(({ path, target, pathRewrite }) => {
        const proxyOptions: Options = {
            target,
            changeOrigin: true,
            pathRewrite,
            onError: (err: any, req: any, res: any) => {
                logger.error(`Proxy error for ${path}:`, err.message);
                const response = res as any;
                if (response.status) {
                    response.status(502).json({
                        success: false,
                        error: {
                            code: 'SERVICE_UNAVAILABLE',
                            message: 'Service temporarily unavailable',
                        },
                    });
                }
            },
            onProxyReq: (proxyReq: any, req: any) => {
                logger.debug(`Proxying ${req.method} ${req.url} -> ${target}`);

                // If body was parsed by express.json(), re-stream it
                if (req.body && Object.keys(req.body).length) {
                    const bodyData = JSON.stringify(req.body);
                    proxyReq.setHeader('Content-Type', 'application/json');
                    proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
                    proxyReq.write(bodyData);
                }
            },
            onProxyRes: (proxyRes: any, req: any, res: any) => {
                logger.debug(`Received response from target: ${proxyRes.statusCode}`);
                // Verify if content-length exists
                logger.debug(`Headers: ${JSON.stringify(proxyRes.headers)}`);
            },
        };

        app.use(path, createProxyMiddleware(proxyOptions));
        logger.info(`Proxy configured: ${path} -> ${target}`);
    });
};
