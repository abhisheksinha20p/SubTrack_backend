
import mongoose from 'mongoose';
import { seedPlans } from './plans.seed';
import { config } from '../config';

const run = async () => {
    try {
        await mongoose.connect(config.mongoUri);
        console.log('Connected to MongoDB');

        await seedPlans();

        console.log('Seeding completed');
        process.exit(0);
    } catch (error) {
        console.error('Seeding failed:', error);
        process.exit(1);
    }
};

run();
