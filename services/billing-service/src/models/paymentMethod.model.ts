import mongoose, { Schema, Document } from 'mongoose';

export interface IPaymentMethod extends Document {
    organizationId: mongoose.Types.ObjectId;
    type: 'card' | 'bank_account';
    card?: {
        brand: string;
        lastFour: string;
        expiryMonth: number;
        expiryYear: number;
    };
    isDefault: boolean;
    stripePaymentMethodId: string;
    createdAt: Date;
}

const paymentMethodSchema = new Schema<IPaymentMethod>(
    {
        organizationId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        type: {
            type: String,
            enum: ['card', 'bank_account'],
            required: true,
        },
        card: {
            brand: String,
            lastFour: String,
            expiryMonth: Number,
            expiryYear: Number,
        },
        isDefault: { type: Boolean, default: false },
        stripePaymentMethodId: {
            type: String,
            required: true,
            unique: true,
        },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// Indexes
paymentMethodSchema.index({ organizationId: 1 });
paymentMethodSchema.index({ stripePaymentMethodId: 1 }, { unique: true });

export const PaymentMethod = mongoose.model<IPaymentMethod>('PaymentMethod', paymentMethodSchema);
