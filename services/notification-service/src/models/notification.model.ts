import mongoose, { Schema, Document } from 'mongoose';

export type NotificationType = 'info' | 'success' | 'warning' | 'error' | 'billing' | 'security';

export interface INotification extends Document {
    userId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    data?: Record<string, unknown>;
    channels: string[];
    readAt?: Date;
    actionUrl?: string;
    createdAt: Date;
}

const notificationSchema = new Schema<INotification>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['info', 'success', 'warning', 'error', 'billing', 'security'],
            default: 'info',
            required: true,
        },
        title: {
            type: String,
            required: true,
            trim: true,
            maxlength: 200,
        },
        message: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000,
        },
        data: Schema.Types.Mixed,
        channels: [{
            type: String,
            enum: ['in_app', 'email', 'sms', 'push'],
        }],
        readAt: Date,
        actionUrl: String,
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, readAt: 1 });
// TTL index: auto-delete after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

export const Notification = mongoose.model<INotification>('Notification', notificationSchema);
