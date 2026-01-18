import mongoose, { Schema, Document } from 'mongoose';

export type InvoiceStatus = 'draft' | 'pending' | 'paid' | 'failed' | 'refunded' | 'void';

export interface IInvoiceLineItem {
    description: string;
    quantity: number;
    unitPrice: number;
    amount: number;
}

export interface IInvoice extends Document {
    subscriptionId: mongoose.Types.ObjectId;
    organizationId: mongoose.Types.ObjectId;
    invoiceNumber: string;
    lineItems: IInvoiceLineItem[];
    subtotal: number;
    tax: number;
    total: number;
    currency: string;
    status: InvoiceStatus;
    dueDate: Date;
    paidAt?: Date;
    pdfUrl?: string;
    stripeInvoiceId?: string;
    createdAt: Date;
}

const invoiceSchema = new Schema<IInvoice>(
    {
        subscriptionId: {
            type: Schema.Types.ObjectId,
            required: true,
            ref: 'Subscription',
        },
        organizationId: {
            type: Schema.Types.ObjectId,
            required: true,
            index: true,
        },
        invoiceNumber: {
            type: String,
            required: true,
            unique: true,
        },
        lineItems: [{
            description: { type: String, required: true },
            quantity: { type: Number, required: true, default: 1 },
            unitPrice: { type: Number, required: true },
            amount: { type: Number, required: true },
        }],
        subtotal: { type: Number, required: true },
        tax: { type: Number, default: 0 },
        total: { type: Number, required: true },
        currency: { type: String, default: 'USD' },
        status: {
            type: String,
            enum: ['draft', 'pending', 'paid', 'failed', 'refunded', 'void'],
            default: 'pending',
            required: true,
        },
        dueDate: { type: Date, required: true },
        paidAt: Date,
        pdfUrl: String,
        stripeInvoiceId: { type: String, sparse: true },
    },
    {
        timestamps: { createdAt: true, updatedAt: false },
    }
);

// Indexes
invoiceSchema.index({ organizationId: 1, createdAt: -1 });
invoiceSchema.index({ invoiceNumber: 1 }, { unique: true });
invoiceSchema.index({ status: 1, dueDate: 1 });
invoiceSchema.index({ stripeInvoiceId: 1 }, { sparse: true });

// Auto-generate invoice number
invoiceSchema.pre('save', async function (next) {
    if (this.isNew && !this.invoiceNumber) {
        const year = new Date().getFullYear();
        const count = await mongoose.model('Invoice').countDocuments() + 1;
        this.invoiceNumber = `INV-${year}-${count.toString().padStart(4, '0')}`;
    }
    next();
});

export const Invoice = mongoose.model<IInvoice>('Invoice', invoiceSchema);
