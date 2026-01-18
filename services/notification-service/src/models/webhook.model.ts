import mongoose, { Schema, Document } from 'mongoose';
import crypto from 'crypto';

export interface IWebhook extends Document {
    organizationId: mongoose.Types.ObjectId;
    url: string;
    events: string[];
    secret: string;
    isActive: boolean;
    lastTriggeredAt?: Date;
    failureCount: number;
    createdAt: Date;
    updatedAt: Date;
}

const webhookSchema = new Schema<IWebhook>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        url: {
            type: String,
            required: true,
            trim: true,
        },
        events: [{
            type: String,
            required: true,
        }],
        secret: {
            type: String,
            required: true,
        },
        isActive: { type: Boolean, default: true },
        lastTriggeredAt: Date,
        failureCount: { type: Number, default: 0 },
    },
    {
        timestamps: true,
    }
);

// Generate secret on create
webhookSchema.pre('save', function (next) {
    if (this.isNew && !this.secret) {
        this.secret = `whsec_${crypto.randomBytes(24).toString('hex')}`;
    }
    next();
});

// Indexes
webhookSchema.index({ organizationId: 1 });
webhookSchema.index({ isActive: 1 });

export const Webhook = mongoose.model<IWebhook>('Webhook', webhookSchema);
