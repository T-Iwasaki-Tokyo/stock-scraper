import { NextResponse } from 'next/server';
import { fetchStockList } from '@/lib/scraper';
import { supabase } from '@/lib/supabase';

export async function POST() {
    try {
        // 現在の設定を Supabase から取得
        const { data: configRows } = await supabase
            .from('configs')
            .select('*')
            .eq('is_current', true)
            .single();

        const config = configRows || { mode: 'condition' };

        let stocks = [];

        if (config.mode === 'file') {
            // ファイル読み込みモード: target_stocks から取得
            const { data: targetStocks, error } = await supabase
                .from('target_stocks')
                .select('code, name');
            
            if (error) throw error;

            stocks = (targetStocks || []).map(s => ({
                code: s.code,
                name: s.name,
                status: 'pending'
            }));
        } else {
            // 条件検索モード: 従来通り Yahoo から検索
            stocks = await fetchStockList(config);
        }
        
        return NextResponse.json({ success: true, stocks });
    } catch (e: any) {
        console.error('List API Error:', e);
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
