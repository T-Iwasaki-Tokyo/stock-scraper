import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import * as XLSX from 'xlsx';

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
        
        const stocks = data
            .filter(row => row[0]) // コードがある行のみ
            .map(row => ({
                code: row[0].toString().trim(),
                name: row[1]?.toString().trim() || '名称未設定'
            }));

        if (stocks.length === 0) {
            return NextResponse.json({ error: '有効な銘柄コードが見つかりませんでした' }, { status: 400 });
        }

        // 既存の target_stocks をクリアして新しく追加
        await supabase.from('target_stocks').delete().neq('code', '');
        
        const { error: insertError } = await supabase
            .from('target_stocks')
            .insert(stocks);

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
