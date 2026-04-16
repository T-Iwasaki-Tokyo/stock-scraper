import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // API側はService Roleを使用（書き込み用）

export const supabase = createClient(supabaseUrl, supabaseKey);
