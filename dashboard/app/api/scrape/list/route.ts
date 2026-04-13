import { NextResponse } from 'next/server';
import { fetchStockList } from '../../../../scraper.js';
import fs from 'fs';
import path from 'path';

export async function POST() {
    try {
        const rootDir = path.resolve(process.cwd(), '..');
        const configPath = path.join(rootDir, 'config.json');
        const resultsPath = path.join(rootDir, 'results.json');
        
        const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
        
        // リストを取得
        const stocks = await fetchStockList(config);
        
        // 最初のリストを保存（詳細待ち状態として）
        fs.writeFileSync(resultsPath, JSON.stringify(stocks, null, 2));
        
        return NextResponse.json({ success: true, stocks });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
