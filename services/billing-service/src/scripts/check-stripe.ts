
import { config } from '../config';
import Stripe from 'stripe';

const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });

const run = async () => {
    console.log(`Checking Stripe Key: ${config.stripeSecretKey.substring(0, 8)}...`);
    try {
        const customers = await stripe.customers.list({ limit: 1 });
        console.log('✅ Stripe Key is VALID. Connected to Stripe account.');
        console.log('Customers found:', customers.data.length);
    } catch (error: any) {
        console.error('❌ Stripe Key is INVALID.');
        console.error('Error Type:', error.type);
        console.error('Error Message:', error.message);
    }
};

run();
