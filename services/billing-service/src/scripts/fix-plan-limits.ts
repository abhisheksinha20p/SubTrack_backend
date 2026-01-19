
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { Plan } from '../models/plan.model';

// Load env vars
dotenv.config({ path: path.join(__dirname, '../../../../../.env') });

const MONGODB_URI = 'mongodb://localhost:29029/subtrack_billing';

async function fixPlanLimits() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB at', MONGODB_URI);

        // Find Free Plan
        const freePlan = await Plan.findOne({ slug: 'free' });
        if (freePlan) {
            console.log('Updating Free Plan limits...');
            freePlan.limits = {
                users: 3,
                projects: 1,
                storage: 100, // 100 MB
                apiCalls: 0   // No API access
            };
            await freePlan.save();
            console.log('Free Plan updated:', freePlan.limits);
        } else {
            console.log('Free Plan not found!');
        }

        // Find Pro Plan (optional update)
        const proPlan = await Plan.findOne({ slug: 'pro' });
        if (proPlan) {
            console.log('Updating Pro Plan limits...');
            proPlan.limits = {
                users: 10,
                projects: 20,
                storage: 10240, // 10GB
                apiCalls: 50000
            };
            await proPlan.save();
            console.log('Pro Plan updated:', proPlan.limits);
        }

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

fixPlanLimits();
