
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import path from 'path';
import Stripe from 'stripe';
import { Invoice, Subscription } from '../models';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(process.cwd(), '.env') });

const MONGODB_URI = 'mongodb://localhost:29029/subtrack_billing';
const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;

if (!STRIPE_SECRET_KEY) {
    console.error('STRIPE_SECRET_KEY not found');
    process.exit(1);
}

const stripe = new Stripe(STRIPE_SECRET_KEY, {
    apiVersion: '2023-10-16' as any,
});

async function syncInvoices() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const stripeInvoices = await stripe.invoices.list({ limit: 100, status: 'paid' });
        console.log(`Found ${stripeInvoices.data.length} PAID invoices in Stripe.`);

        for (const stripeInv of stripeInvoices.data) {
            // Find subscription/org by customer
            const subscription = await Subscription.findOne({ stripeCustomerId: stripeInv.customer });

            if (!subscription) {
                console.log(`Skipping invoice ${stripeInv.id}: No local subscription found for customer ${stripeInv.customer}`);
                continue;
            }

            // Map line items
            const lineItems = stripeInv.lines.data.map(line => ({
                description: line.description || 'Plan subscription',
                quantity: line.quantity || 1,
                unitPrice: (line.price?.unit_amount || 0) / 100,
                amount: (line.amount || 0) / 100,
            }));

            // Create/Update Invoice
            // We use findOneAndUpdate with upsert
            const invoiceData = {
                subscriptionId: subscription._id,
                organizationId: subscription.organizationId,
                invoiceNumber: stripeInv.number || `INV-${stripeInv.created}`,
                stripeInvoiceId: stripeInv.id,
                amount: stripeInv.amount_paid / 100,
                total: stripeInv.total / 100,
                subtotal: stripeInv.subtotal / 100,
                tax: (stripeInv.tax || 0) / 100,
                currency: stripeInv.currency,
                status: stripeInv.status,
                downloadUrl: stripeInv.invoice_pdf,
                pdfUrl: stripeInv.invoice_pdf,
                createdAt: new Date(stripeInv.created * 1000),
                dueDate: stripeInv.due_date ? new Date(stripeInv.due_date * 1000) : new Date(stripeInv.created * 1000),
                paidAt: stripeInv.status_transitions?.paid_at ? new Date(stripeInv.status_transitions.paid_at * 1000) : undefined,
                lineItems: lineItems
            };

            await Invoice.findOneAndUpdate(
                { stripeInvoiceId: stripeInv.id },
                invoiceData,
                { upsert: true, new: true, setDefaultsOnInsert: true }
            );
            console.log(`Synced invoice ${stripeInv.number} for Org ${subscription.organizationId}`);
        }

        console.log('Sync complete.');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

syncInvoices();
