import { NextResponse } from 'next/server';
import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

export async function POST() {
    // 実行前に結果とステータスをクリア
    const rootDir = path.resolve(process.cwd(), '..');
    const resultsPath = path.join(rootDir, 'results.json');
    const statusPath = path.join(rootDir, 'status.json');

    fs.writeFileSync(resultsPath, '[]');
    fs.writeFileSync(statusPath, JSON.stringify({ phase: 'idle', message: '待機中', current: 0, total: 0 }));

    const scraperPath = path.join(rootDir, 'scraper.js');

    // バックグラウンドでスクレイパーを実行
    const child = spawn('node', [scraperPath], {
        detached: true,
        stdio: 'ignore',
        cwd: rootDir,
        env: { ...process.env, PATH: process.env.PATH + ':/usr/local/bin:/opt/homebrew/bin' }
    });

    child.unref();

    return NextResponse.json({ success: true, message: 'Scraper started and results cleared' });
}
