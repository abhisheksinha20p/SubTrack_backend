// Script to create Stripe products/prices and update MongoDB plans
import Stripe from 'stripe';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';

// Load from project root .env
dotenv.config({ path: path.resolve(__dirname, '../../../../../.env') });

const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY || '';
const MONGODB_URI = 'mongodb://localhost:29029/subtrack_billing';

console.log('Using Stripe Key:', STRIPE_SECRET_KEY ? STRIPE_SECRET_KEY.substring(0, 20) + '...' : 'NOT SET');
console.log('Using MongoDB:', MONGODB_URI);

const stripe = new Stripe(STRIPE_SECRET_KEY);

// Plan configurations
const planConfigs = [
    {
        slug: 'pro',
        name: 'Pro Plan',
        description: 'For growing teams',
        monthlyPrice: 2900, // $29.00 in cents
    },
    {
        slug: 'enterprise',
        name: 'Enterprise Plan',
        description: 'For large organizations',
        monthlyPrice: 9900, // $99.00 in cents
    },
];

async function main() {
    // Connect to MongoDB
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');

    const planCollection = mongoose.connection.collection('plans');

    for (const config of planConfigs) {
        console.log(`\n=== Setting up ${config.name} ===`);

        // Check if product already exists
        const existingProducts = await stripe.products.search({
            query: `metadata["slug"]:"${config.slug}"`,
        });

        let product: Stripe.Product;
        if (existingProducts.data.length > 0) {
            product = existingProducts.data[0];
            console.log(`Found existing product: ${product.id}`);
        } else {
            // Create product
            product = await stripe.products.create({
                name: config.name,
                description: config.description,
                metadata: { slug: config.slug },
            });
            console.log(`Created product: ${product.id}`);
        }

        // Check if price already exists
        const existingPrices = await stripe.prices.list({
            product: product.id,
            active: true,
        });

        let monthlyPrice: Stripe.Price;
        const existingMonthly = existingPrices.data.find(
            p => p.recurring?.interval === 'month' && p.unit_amount === config.monthlyPrice
        );

        if (existingMonthly) {
            monthlyPrice = existingMonthly;
            console.log(`Found existing monthly price: ${monthlyPrice.id}`);
        } else {
            // Create monthly price
            monthlyPrice = await stripe.prices.create({
                product: product.id,
                unit_amount: config.monthlyPrice,
                currency: 'usd',
                recurring: { interval: 'month' },
                metadata: { slug: config.slug, billing_cycle: 'monthly' },
            });
            console.log(`Created monthly price: ${monthlyPrice.id}`);
        }

        // Update MongoDB plan with stripePriceId
        const result = await planCollection.updateOne(
            { slug: config.slug },
            {
                $set: {
                    'stripePriceId.monthly': monthlyPrice.id,
                },
            }
        );
        console.log(`Updated MongoDB plan: ${result.modifiedCount} document(s) modified`);
    }

    // Verify the updates
    console.log('\n=== Verification ===');
    const plans = await planCollection.find({}).toArray();
    for (const plan of plans) {
        console.log(`${plan.name}: stripePriceId =`, plan.stripePriceId || 'not set');
    }

    await mongoose.disconnect();
    console.log('\nDone!');
}

main().catch(err => {
    console.error('Error:', err);
    process.exit(1);
});
