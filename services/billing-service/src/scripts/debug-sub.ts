
import mongoose from 'mongoose';
import { Subscription } from '../models/subscription.model';
import { Plan } from '../models/plan.model';
import { config } from '../config';
import Stripe from 'stripe';

const stripe = new Stripe(config.stripeSecretKey, { apiVersion: '2023-10-16' });

const run = async () => {
    try {
        await mongoose.connect(config.mongoUri);
        const orgId = '696deaa7e8383627243eb422';
        console.log('Checking subscription for Org:', orgId);

        const sub = await Subscription.findOne({ organizationId: orgId }).populate('planId');
        if (!sub) {
            console.log('No subscription found in DB.');
            return;
        }
        console.log('Current DB Plan:', (sub.planId as any)?.name);
        console.log('Stripe Customer ID:', sub.stripeCustomerId);

        if (!sub.stripeCustomerId) {
            console.log('No Stripe Customer ID.');
            return;
        }

        const subscriptions = await stripe.subscriptions.list({
            customer: sub.stripeCustomerId,
            limit: 1,
            status: 'all',
        });

        if (subscriptions.data.length === 0) {
            console.log('No subscriptions found on Stripe for this customer.');
            return;
        }

        const stripeSub = subscriptions.data[0];
        console.log('Stripe Subscription found:', stripeSub.id);
        console.log('Stripe Status:', stripeSub.status);
        console.log('Stripe Metadata:', stripeSub.metadata);

        if (stripeSub.items.data.length > 0) {
            const price = stripeSub.items.data[0].price;
            console.log('Stripe Price:', price.unit_amount, price.currency);
            console.log('Interval:', price.recurring?.interval);

            const priceAmount = price.unit_amount;
            if (priceAmount !== null) {
                console.log('Searching for plan with price:', priceAmount / 100);
                const matchedPlan = await Plan.findOne({
                    $or: [
                        { 'pricing.monthly': priceAmount / 100 },
                        { 'pricing.yearly': priceAmount / 100 }
                    ]
                });
                if (matchedPlan) {
                    console.log('✅ Matched Plan:', matchedPlan.name, matchedPlan._id);
                    // Simulate save
                    sub.planId = matchedPlan._id;
                    sub.status = stripeSub.status as any;
                    await sub.save();
                    console.log('Updated subscription in DB.');
                } else {
                    console.log('❌ No plan matched for price:', priceAmount / 100);
                    const allPlans = await Plan.find({});
                    console.log('Available Plans:', allPlans.map(p => ({ name: p.name, monthly: p.pricing?.monthly, yearly: p.pricing?.yearly })));
                }
            }
        }

    } catch (e) {
        console.error(e);
    } finally {
        await mongoose.disconnect();
        process.exit(0);
    }
};

run();
