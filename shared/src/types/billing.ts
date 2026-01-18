// Billing Types

export interface Plan {
    id: string;
    name: string;
    slug: string;
    description?: string;
    pricing: PlanPricing;
    features: PlanFeature[];
    limits: PlanLimits;
    isActive: boolean;
    isPopular: boolean;
    sortOrder: number;
}

export interface PlanPricing {
    monthly: number;
    yearly: number;
    currency: string;
}

export interface PlanFeature {
    name: string;
    included: boolean;
    limit?: number;
}

export interface PlanLimits {
    users: number;      // -1 = unlimited
    projects: number;
    storage: number;    // MB
    apiCalls: number;   // per month
}

// Subscription Types
export interface Subscription {
    id: string;
    organizationId: string;
    planId: string;
    planName: string;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    currentPeriod: {
        start: Date;
        end: Date;
    };
    cancelAtPeriodEnd: boolean;
    canceledAt?: Date;
    createdAt: Date;
}

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
export type BillingCycle = 'monthly' | 'yearly';

export interface CreateSubscriptionRequest {
    planId: string;
    billingCycle: BillingCycle;
    paymentMethodId: string;
}

export interface CancelSubscriptionRequest {
    reason?: string;
    feedback?: string;
}

// Invoice Types
export interface Invoice {
    id: string;
    subscriptionId: string;
    organizationId: string;
    invoiceNumber: string;
    lineItems: InvoiceLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    status: InvoiceStatus;
    dueDate: Date;
    paidAt?: Date;
    pdfUrl?: string;
    createdAt: Date;
}

export interface InvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
}

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'failed' | 'refunded' | 'void';

// Payment Method Types
export interface PaymentMethod {
    id: string;
    organizationId: string;
    type: 'card' | 'bank_account';
    card?: {
        brand: string;
        lastFour: string;
        expiryMonth: number;
        expiryYear: number;
    };
    isDefault: boolean;
    createdAt: Date;
}

// Usage Types
export interface Usage {
    period: {
        start: Date;
        end: Date;
    };
    usage: {
        users: UsageMetric;
        projects: UsageMetric;
        storage: UsageMetric;
        apiCalls: UsageMetric;
    };
}

export interface UsageMetric {
    used: number;
    limit: number;
    unit?: string;
}
