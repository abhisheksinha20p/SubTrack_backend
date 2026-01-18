// Notification Types

export interface Notification {
    id: string;
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    read: boolean;
    readAt?: Date;
    actionUrl?: string;
    createdAt: Date;
}

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'billing' | 'security';

export interface NotificationPreferences {
    channels: {
        email: boolean;
        inApp: boolean;
        push: boolean;
    };
    categories: {
        billing: ChannelPreference;
        security: ChannelPreference;
        marketing: ChannelPreference;
        product: ChannelPreference;
    };
}

export interface ChannelPreference {
    email: boolean;
    inApp: boolean;
}

export interface UpdatePreferencesRequest {
    channels?: Partial<NotificationPreferences['channels']>;
    categories?: Partial<NotificationPreferences['categories']>;
}

// Webhook Types
export interface Webhook {
    id: string;
    organizationId: string;
    url: string;
    events: string[];
    secret?: string; // Only returned on create
    isActive: boolean;
    lastTriggeredAt?: Date;
    failureCount: number;
    createdAt: Date;
}

export interface CreateWebhookRequest {
    url: string;
    events: string[];
}

export interface UpdateWebhookRequest {
    url?: string;
    events?: string[];
    isActive?: boolean;
}

export interface WebhookTestResponse {
    delivered: boolean;
    responseCode: number;
    responseTime: number;
}

// Webhook Events
export const WebhookEvents = [
    'user.registered',
    'subscription.created',
    'subscription.upgraded',
    'subscription.canceled',
    'invoice.generated',
    'invoice.paid',
    'payment.failed',
] as const;

export type WebhookEvent = typeof WebhookEvents[number];
