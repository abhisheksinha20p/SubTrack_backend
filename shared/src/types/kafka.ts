// Kafka Event Types

export interface KafkaEvent<T = unknown> {
    id: string;
    type: string;
    timestamp: string;
    source: string;
    correlationId?: string;
    data: T;
}

// User Events
export interface UserRegisteredEvent {
    userId: string;
    email: string;
    firstName: string;
    lastName: string;
}

export interface UserLoginEvent {
    userId: string;
    ip: string;
    userAgent: string;
    deviceType: string;
    isNewDevice: boolean;
}

export interface UserProfileUpdatedEvent {
    userId: string;
    changes: Record<string, { old: unknown; new: unknown }>;
}

// Organization Events
export interface OrgCreatedEvent {
    organizationId: string;
    ownerId: string;
    name: string;
    slug: string;
}

export interface OrgMemberInvitedEvent {
    organizationId: string;
    organizationName: string;
    inviteeEmail: string;
    invitedBy: string;
    role: string;
}

// Billing Events
export interface SubscriptionCreatedEvent {
    subscriptionId: string;
    organizationId: string;
    planId: string;
    planName: string;
    status: string;
    billingCycle: string;
}

export interface SubscriptionCanceledEvent {
    subscriptionId: string;
    organizationId: string;
    cancelAt: string;
    reason?: string;
}

export interface InvoiceGeneratedEvent {
    invoiceId: string;
    invoiceNumber: string;
    organizationId: string;
    amount: number;
    currency: string;
    dueDate: string;
}

export interface InvoicePaidEvent {
    invoiceId: string;
    organizationId: string;
    amount: number;
    paidAt: string;
}

export interface PaymentFailedEvent {
    invoiceId: string;
    organizationId: string;
    amount: number;
    errorCode: string;
    errorMessage: string;
}

// Kafka Topics
export const KafkaTopics = {
    USER_EVENTS: 'user.events',
    BILLING_EVENTS: 'billing.events',
    NOTIFICATION_EVENTS: 'notification.events',
    AUDIT_EVENTS: 'audit.events',
} as const;

export type KafkaTopic = typeof KafkaTopics[keyof typeof KafkaTopics];
