import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function test() {
    const { data: configRows } = await supabase
        .from('configs')
        .select('*')
        .eq('is_current', true)
        .single();
    console.log("Current Config Row:", JSON.stringify(configRows, null, 2));
}
test().catch(console.error);
