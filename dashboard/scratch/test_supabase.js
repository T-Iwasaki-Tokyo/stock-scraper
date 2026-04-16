import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);
async function test() {
    const { data, error } = await supabase.from('stocks').select('*').limit(1);
    if (error) {
        console.error("Error:", error);
    } else if (data && data.length > 0) {
        console.log("Columns:", Object.keys(data[0]));
    } else {
        console.log("Empty table, inserting dummy to get error/schema...");
    }
}
test().catch(console.error);
