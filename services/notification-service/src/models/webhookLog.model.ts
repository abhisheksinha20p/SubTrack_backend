import mongoose, { Schema, Document } from 'mongoose';

export interface IWebhookLog extends Document {
    webhookId: mongoose.Types.ObjectId;
    event: string;
    payload: Record<string, unknown>;
    responseCode?: number;
    responseBody?: string;
    delivered: boolean;
    retryCount: number;
    createdAt: Date;
}

const webhookLogSchema = new Schema<IWebhookLog>(
    {
        webhookId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
            ref: 'Webhook',
        },
        event: {
            type: String,
            required: true,
        },
        payload: Schema.Types.Mixed,
        responseCode: Number,
        responseBody: String,
        delivered: { type: Boolean, default: false },
        retryCount: { type: Number, default: 0 },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// TTL: auto-delete after 7 days
webhookLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7 * 24 * 60 * 60 });
webhookLogSchema.index({ webhookId: 1, createdAt: -1 });

export const WebhookLog = mongoose.model<IWebhookLog>('WebhookLog', webhookLogSchema);
