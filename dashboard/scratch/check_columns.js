import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

(async () => {
    const { data, error } = await supabase
        .from('stocks')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Error fetching data:', error.message);
    } else {
        console.log('Available columns in "stocks" table:', Object.keys(data[0] || {}));
    }
})();
