const mongoose = require('mongoose');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/subtrack_users';

const memberSchema = new mongoose.Schema({
    userId: { type: String, required: true },
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'Organization', required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ['owner', 'admin', 'member', 'viewer'], required: true },
    status: { type: String, enum: ['active', 'pending', 'inactive'], default: 'active' },
}, { timestamps: true });

const organizationSchema = new mongoose.Schema({
    name: String,
    ownerId: String,
});

const Member = mongoose.model('Member', memberSchema);
const Organization = mongoose.model('Organization', organizationSchema);

async function fixMissingMembers() {
    try {
        await mongoose.connect(MONGODB_URI);
        console.log('Connected to MongoDB');

        const orgs = await Organization.find();
        console.log(`Found ${orgs.length} organizations`);

        for (const org of orgs) {
            console.log(`Checking org: ${org.name} (${org._id}) Owner: ${org.ownerId}`);

            const member = await Member.findOne({
                organizationId: org._id,
                userId: org.ownerId
            });

            if (!member) {
                console.log(`❌ Missing member record for owner of ${org.name}. Creating one...`);
                await Member.create({
                    userId: org.ownerId,
                    organizationId: org._id,
                    email: 'fixed_by_script@example.com', // Placeholder
                    role: 'owner',
                    status: 'active'
                });
                console.log(`✅ Created owner member record for ${org.name}`);
            } else {
                console.log(`✅ Member record exists for ${org.name}`);
            }
        }

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await mongoose.disconnect();
    }
}

fixMissingMembers();
