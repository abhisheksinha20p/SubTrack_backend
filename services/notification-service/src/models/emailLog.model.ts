import mongoose, { Schema, Document } from 'mongoose';

export type EmailStatus = 'queued' | 'sent' | 'failed' | 'bounced';

export interface IEmailLog extends Document {
    userId?: mongoose.Types.ObjectId;
    to: string;
    subject: string;
    template: string;
    status: EmailStatus;
    provider?: string;
    messageId?: string;
    errorMessage?: string;
    sentAt?: Date;
    createdAt: Date;
}

const emailLogSchema = new Schema<IEmailLog>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            index: true,
        },
        to: {
            type: String,
            required: true,
        },
        subject: {
            type: String,
            required: true,
        },
        template: {
            type: String,
            required: true,
        },
        status: {
            type: String,
            enum: ['queued', 'sent', 'failed', 'bounced'],
            default: 'queued',
            required: true,
        },
        provider: String,
        messageId: String,
        errorMessage: String,
        sentAt: Date,
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// TTL: auto-delete after 30 days
emailLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });
emailLogSchema.index({ userId: 1, createdAt: -1 });
emailLogSchema.index({ status: 1 });

export const EmailLog = mongoose.model<IEmailLog>('EmailLog', emailLogSchema);
