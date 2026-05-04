import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST() {
  try {
    // stocks テーブルの削除
    const { error: stocksError } = await supabase
      .from('stocks')
      .delete()
      .neq('code', ''); // 全件削除のためのトリック（ID等の代わり）

    if (stocksError) throw stocksError;

    // target_stocks テーブルの削除
    const { error: targetError } = await supabase
      .from('target_stocks')
      .delete()
      .neq('code', '');

    if (targetError) throw targetError;

    // 検索状態をリセットするためにスクレイピング用ステータスも更新が必要かもしれないが
    // ここではデータ本体のみを消去

    return NextResponse.json({ success: true, message: 'すべてのデータを削除しました' });
  } catch (error: any) {
    console.error('Clear data error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
