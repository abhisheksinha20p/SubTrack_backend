import mongoose, { Schema, Document } from 'mongoose';

export interface IPlanFeature {
    name: string;
    included: boolean;
    limit?: number;
}

export interface IPlanLimits {
    users: number;      // -1 = unlimited
    projects: number;
    storage: number;    // MB
    apiCalls: number;   // per month
}

export interface IPlan extends Document {
    name: string;
    slug: string;
    description?: string;
    pricing: {
        monthly: number;
        yearly: number;
        currency: string;
    };
    stripePriceId?: {
        monthly?: string;
        yearly?: string;
    };
    features: IPlanFeature[];
    limits: IPlanLimits;
    isActive: boolean;
    isPopular: boolean;
    sortOrder: number;
    createdAt: Date;
    updatedAt: Date;
}

const planSchema = new Schema<IPlan>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        description: String,
        pricing: {
            monthly: { type: Number, required: true, default: 0 },
            yearly: { type: Number, required: true, default: 0 },
            currency: { type: String, default: 'USD' },
        },
        stripePriceId: {
            monthly: String,
            yearly: String,
        },
        features: [{
            name: { type: String, required: true },
            included: { type: Boolean, default: true },
            limit: Number,
        }],
        limits: {
            users: { type: Number, default: -1 },
            projects: { type: Number, default: 1 },
            storage: { type: Number, default: 100 },
            apiCalls: { type: Number, default: 1000 },
        },
        isActive: { type: Boolean, default: true },
        isPopular: { type: Boolean, default: false },
        sortOrder: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    }
);

// Indexes
planSchema.index({ slug: 1 }, { unique: true });
planSchema.index({ isActive: 1, sortOrder: 1 });

export const Plan = mongoose.model<IPlan>('Plan', planSchema);
