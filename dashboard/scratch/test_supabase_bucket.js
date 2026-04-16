import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function test() {
    const { data: buckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) console.error("List error:", listError);
    else console.log("Buckets:", buckets.map(b => b.name));

    if (!buckets?.find(b => b.name === 'screenshots')) {
        console.log("Creating bucket 'screenshots'...");
        const { error: createError } = await supabase.storage.createBucket('screenshots', {
            public: true,
            fileSizeLimit: 10485760 // 10MB
        });
        if (createError) console.error("Create error:", createError);
        else console.log("Bucket created successfully.");
    } else {
        console.log("Bucket already exists. Updating to public just in case...");
        const { error: updateError } = await supabase.storage.updateBucket('screenshots', {
            public: true,
        });
        if (updateError) console.error("Update error:", updateError);
        else console.log("Bucket updated to public.");
    }
}
test().catch(console.error);
