import mongoose, { Schema, Document } from 'mongoose';

export type MemberRole = 'owner' | 'admin' | 'member' | 'viewer';
export type MemberStatus = 'pending' | 'active' | 'inactive';

export interface IMember extends Document {
    userId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    role: MemberRole;
    email: string;
    firstName?: string;
    lastName?: string;
    invitedBy?: mongoose.Types.ObjectId;
    invitedAt?: Date;
    joinedAt?: Date;
    status: MemberStatus;
    createdAt: Date;
    updatedAt: Date;
}

const memberSchema = new Schema<IMember>(
    {
        userId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        organizationId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        role: {
            type: String,
            enum: ['owner', 'admin', 'member', 'viewer'],
            default: 'member',
            required: true,
        },
        email: {
            type: String,
            required: true,
            lowercase: true,
            trim: true,
        },
        firstName: String,
        lastName: String,
        invitedBy: Schema.Types.ObjectId,
        invitedAt: Date,
        joinedAt: Date,
        status: {
            type: String,
            enum: ['pending', 'active', 'inactive'],
            default: 'pending',
        },
    },
    {
        timestamps: true,
    }
);

// Compound unique index: one user per organization
memberSchema.index({ organizationId: 1, userId: 1 }, { unique: true });
memberSchema.index({ organizationId: 1, status: 1 });
memberSchema.index({ userId: 1 });

export const Member = mongoose.model<IMember>('Member', memberSchema);
