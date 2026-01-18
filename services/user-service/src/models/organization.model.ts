import mongoose, { Schema, Document } from 'mongoose';

export interface IOrganization extends Document {
    name: string;
    slug: string;
    ownerId: mongoose.Types.ObjectId;
    logoUrl?: string;
    billingEmail?: string;
    industry?: string;
    size?: '1-10' | '11-50' | '51-200' | '201-500' | '500+';
    settings: {
        timezone: string;
        dateFormat: string;
        currency: string;
    };
    createdAt: Date;
    updatedAt: Date;
}

const organizationSchema = new Schema<IOrganization>(
    {
        name: {
            type: String,
            required: true,
            trim: true,
            maxlength: 100,
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            match: /^[a-z0-9-]+$/,
        },
        ownerId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        logoUrl: String,
        billingEmail: {
            type: String,
            lowercase: true,
            trim: true,
        },
        industry: String,
        size: {
            type: String,
            enum: ['1-10', '11-50', '51-200', '201-500', '500+'],
        },
        settings: {
            timezone: { type: String, default: 'UTC' },
            dateFormat: { type: String, default: 'MM/DD/YYYY' },
            currency: { type: String, default: 'USD' },
        },
    },
    {
        timestamps: true,
    }
);

// Indexes
organizationSchema.index({ slug: 1 }, { unique: true });
organizationSchema.index({ ownerId: 1 });
organizationSchema.index({ createdAt: -1 });

export const Organization = mongoose.model<IOrganization>('Organization', organizationSchema);
