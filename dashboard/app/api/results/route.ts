import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY! // API経由での一括取得のためサービスロールを使用
);

export async function GET() {
    try {
        const { data, error } = await supabase
            .from('stocks')
            .select('*')
            .order('updated_at', { ascending: false });

        if (error) throw error;

        // フロントエンドの形式に合わせてマッピング
        const stocks = data.map(s => ({
            code: s.code,
            name: s.name,
            price: s.price || '取得中...',
            totalYield: s.total_yield,
            dividendYield: s.dividend_yield || '待機中...',
            pbr: s.pbr || '待機中...',
            status: s.status,
            yahooUrl: s.yahoo_url,
            chartUrl: s.chart_url,
            timestamp: s.updated_at ? new Date(s.updated_at).toLocaleString('ja-JP') : null
        }));

        return NextResponse.json(stocks);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
