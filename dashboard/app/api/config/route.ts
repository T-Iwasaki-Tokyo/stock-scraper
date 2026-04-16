import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

const DEFAULT_CONFIG = {
    name: 'デフォルト設定',
    mode: 'condition',
    search: {
        minAmount: '',
        maxAmount: '',
        minYieldYutai: '',
        minYieldDividend: '',
        minYieldTotal: '',
        months: [],
        minRecommendation: '',
        categories: [],
        longTerm: '',             // 全銘柄
        creditTrading: '',        // 全銘柄
        includeGoingConcern: ''   // 全銘柄
    },
    scraping: {
        intervalMinutes: 1,
        maxStocks: 100
    }
};

export async function GET() {
    try {
        const { data: configs, error } = await supabase
            .from('configs')
            .select('*')
            .order('created_at', { ascending: false });

        if (error) throw error;

        let current = configs.find(c => c.is_current) || configs[0] || null;
        
        // 初回起動時（DBが空の場合）のデフォルト設定
        if (!current) {
            current = DEFAULT_CONFIG;
        }

        return NextResponse.json({
            current: current,
            history: configs || []
        });
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const { name, config: newConfig } = await request.json();
        
        // すべての is_current を false に更新
        await supabase
            .from('configs')
            .update({ is_current: false })
            .neq('id', -1); // 全体に適用するためのダミー条件

        // 新しい設定を挿入 (is_current = true)
        const historyEntry = {
            name: name || `設定_${new Date().toLocaleString('ja-JP')}`,
            search: newConfig.search,
            scraping: newConfig.scraping,
            mode: newConfig.mode || 'condition',
            is_current: true,
            created_at: new Date().toISOString()
        };

        const { data: inserted, error: insertError } = await supabase
            .from('configs')
            .insert([historyEntry])
            .select()
            .single();

        if (insertError) throw insertError;

        // 12件超えた分を削除
        const { data: allConfigs } = await supabase
            .from('configs')
            .select('id')
            .order('created_at', { ascending: false });

        if (allConfigs && allConfigs.length > 12) {
            const idsToDelete = allConfigs.slice(12).map(c => c.id);
            await supabase.from('configs').delete().in('id', idsToDelete);
        }

        // 最新の状態を返却
        const { data: updatedConfigs } = await supabase
            .from('configs')
            .select('*')
            .order('created_at', { ascending: false });

        return NextResponse.json({ 
            success: true, 
            config: {
                current: inserted,
                history: updatedConfigs
            } 
        });
    } catch (error: any) {
        console.error('Save Config Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

export async function DELETE(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const name = searchParams.get('name');

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const { error } = await supabase
            .from('configs')
            .delete()
            .eq('name', name);

        if (error) throw error;

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Delete Config Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
