import { NextResponse } from 'next/server';
import { fetchStockDetail } from '../../../../scraper.js';
import fs from 'fs';
import path from 'path';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');

    if (!code) {
        return NextResponse.json({ success: false, error: 'Missing code' }, { status: 400 });
    }

    try {
        const detail = await fetchStockDetail(code);
        
        // ローカルでの永続性のために results.json を更新（Vercelではこれは無視されますが、ローカルでの動作継続のため）
        const rootDir = path.resolve(process.cwd(), '..');
        const resultsPath = path.join(rootDir, 'results.json');
        
        if (fs.existsSync(resultsPath)) {
            const results = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));
            const idx = results.findIndex((s: any) => s.code === code);
            if (idx !== -1) {
                results[idx] = { ...results[idx], ...detail };
                fs.writeFileSync(resultsPath, JSON.stringify(results, null, 2));
            }
        }

        return NextResponse.json({ success: true, detail });
    } catch (e: any) {
        return NextResponse.json({ success: false, error: e.message }, { status: 500 });
    }
}
