import mongoose, { Schema, Document } from 'mongoose';

export type SubscriptionStatus = 'trialing' | 'active' | 'past_due' | 'canceled' | 'unpaid';
export type BillingCycle = 'monthly' | 'yearly';

export interface ISubscription extends Document {
    organizationId: mongoose.Types.ObjectId;
    planId: mongoose.Types.ObjectId;
    status: SubscriptionStatus;
    billingCycle: BillingCycle;
    currentPeriod: {
        start: Date;
        end: Date;
    };
    trialEnd?: Date;
    cancelAtPeriodEnd: boolean;
    canceledAt?: Date;
    cancellationReason?: string;
    stripeSubscriptionId?: string;
    stripeCustomerId?: string;
    createdAt: Date;
    updatedAt: Date;
}

const subscriptionSchema = new Schema<ISubscription>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        planId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Plan',
        },
        status: {
            type: String,
            enum: ['trialing', 'active', 'past_due', 'canceled', 'unpaid'],
            default: 'active',
            required: true,
        },
        billingCycle: {
            type: String,
            enum: ['monthly', 'yearly'],
            default: 'monthly',
            required: true,
        },
        currentPeriod: {
            start: { type: Date, required: true },
            end: { type: Date, required: true },
        },
        trialEnd: Date,
        cancelAtPeriodEnd: { type: Boolean, default: false },
        canceledAt: Date,
        cancellationReason: String,
        stripeSubscriptionId: { type: String, sparse: true },
        stripeCustomerId: String,
    },
    {
        timestamps: true,
    }
);

// Indexes
subscriptionSchema.index({ organizationId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ 'currentPeriod.end': 1 });
subscriptionSchema.index({ stripeSubscriptionId: 1 }, { sparse: true });

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
