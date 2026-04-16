import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const CONFIG_FILE = path.join(process.cwd(), 'config.json');

function readConfig() {
    if (!fs.existsSync(CONFIG_FILE)) {
        return { current: {}, history: [] };
    }
    return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf-8'));
}

export async function GET() {
    const config = readConfig();
    return NextResponse.json(config);
}

export async function POST(request: Request) {
    const { name, config: newConfig } = await request.json();
    const fullConfig = readConfig();

    // 名前をつけて履歴に追加
    const historyEntry = {
        name: name || `設定_${new Date().toLocaleString('ja-JP')}`,
        ...newConfig,
        timestamp: new Date().toISOString()
    };

    // 履歴の更新（最大12件）
    const newHistory = [historyEntry, ...(fullConfig.history || [])];
    if (newHistory.length > 12) {
        newHistory.pop(); // 古いものを削除
    }

    const updatedFullConfig = {
        current: historyEntry,
        history: newHistory
    };

    fs.writeFileSync(CONFIG_FILE, JSON.stringify(updatedFullConfig, null, 2));
    return NextResponse.json({ success: true, config: updatedFullConfig });
}
