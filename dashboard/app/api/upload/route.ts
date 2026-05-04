import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

// 数値を安全にパースするためのヘルパー
const parseSafeNumber = (val: any): number | null => {
    if (val === undefined || val === null || val === '') return null;
    // Excel の数値変換 (文字列の場合のトリム等)
    const num = typeof val === 'string' ? Number(val.trim()) : Number(val);
    return isNaN(num) ? null : num;
};

export async function POST(request: Request) {
    try {
        const formData = await request.formData();
        const file = formData.get('file') as File;
        
        if (!file) {
            return NextResponse.json({ error: 'ファイルが見つかりません' }, { status: 400 });
        }

        const buffer = await file.arrayBuffer();
        const workbook = XLSX.read(buffer, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        
        // データを取得 (A列: コード, B列: 名称)
        // header: 1 は 配列の配列形式で取得
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 }) as any[][];
        
        // 1行目はヘッダとしてスキップ、2行目以降を取得
        const rawStocks = data.slice(1)
            .filter(row => row[0]) // コードがある行のみ
            .map(row => {
                const code = row[0].toString().trim();
                const name = row[1]?.toString().trim() || '名称未設定';
                
                // 列数によってモードを判定（A〜I列で9列ある場合）
                if (row.length >= 9) {
                    return {
                        code,
                        name,
                        file_dividend_yield: parseSafeNumber(row[2]),
                        sector: row[3]?.toString().trim() || null,
                        invest_ratio: parseSafeNumber(row[4]),
                        invest_amount: parseSafeNumber(row[5]),
                        dividend_sum: parseSafeNumber(row[6]),
                        shares: parseSafeNumber(row[7]),
                        avg_price: parseSafeNumber(row[8])
                    };
                }
                
                // 通常の4列モード
                return {
                    code,
                    name,
                    shares: parseSafeNumber(row[2]),
                    avg_price: parseSafeNumber(row[3])
                };
            });

        if (rawStocks.length === 0) {
            return NextResponse.json({ error: '有効な銘柄コードが見つかりませんでした' }, { status: 400 });
        }

        // 重複除去 (同じコードがあれば後のものを優先)
        const uniqueStocksMap = new Map();
        rawStocks.forEach(s => uniqueStocksMap.set(s.code, s));
        const stocks = Array.from(uniqueStocksMap.values());

        // 既存の target_stocks をクリアして新しく追加
        await supabase.from('target_stocks').delete().neq('code', '');
        
        const { error: insertError } = await supabase
            .from('target_stocks')
            .upsert(stocks);

        if (insertError) throw insertError;

        // 現在のモードを 'file' に切り替え
        await supabase
            .from('configs')
            .update({ mode: 'file' })
            .eq('is_current', true);

        return NextResponse.json({ 
            success: true, 
            count: stocks.length,
            message: `${stocks.length} 件の銘柄を読み込みました。`
        });

    } catch (error: any) {
        console.error('Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
export async function DELETE() {
    try {
        // 全銘柄を削除
        await supabase.from('target_stocks').delete().neq('code', '');
        
        // モードを 'condition' に戻す
        await supabase
            .from('configs')
            .update({ mode: 'condition' })
            .eq('is_current', true);

        return NextResponse.json({ 
            success: true, 
            message: '読み込まれた銘柄リストをクリアし、条件指定モードに戻しました。' 
        });
    } catch (error: any) {
        console.error('Delete Upload Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
