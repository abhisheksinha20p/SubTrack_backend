import mongoose, { Schema, Document } from 'mongoose';

export interface IUserSettings extends Document {
    userId: mongoose.Types.ObjectId;
    notifications: {
        email: boolean;
        inApp: boolean;
        billing: boolean;
        marketing: boolean;
    };
    preferences: {
        theme: 'light' | 'dark' | 'system';
        language: string;
    };
    updatedAt: Date;
}

const userSettingsSchema = new Schema<IUserSettings>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            unique: true,
            index: true,
        },
        notifications: {
            email: { type: Boolean, default: true },
            inApp: { type: Boolean, default: true },
            billing: { type: Boolean, default: true },
            marketing: { type: Boolean, default: false },
        },
        preferences: {
            theme: {
                type: String,
                enum: ['light', 'dark', 'system'],
                default: 'system'
            },
            language: { type: String, default: 'en' },
        },
    },
    {
        timestamps: { createdAt: false, updatedAt: true },
    }
);

export const UserSettings = mongoose.model<IUserSettings>('UserSettings', userSettingsSchema);
