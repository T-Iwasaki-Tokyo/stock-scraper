import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const rootDir = path.resolve(process.cwd(), '..');
    const statusPath = path.join(rootDir, 'status.json');

    try {
        if (!fs.existsSync(statusPath)) {
            return NextResponse.json({ phase: 'idle', message: '待機中', current: 0, total: 0 });
        }
        const data = fs.readFileSync(statusPath, 'utf-8');
        return NextResponse.json(JSON.parse(data));
    } catch (e: any) {
        return NextResponse.json({ phase: 'error', message: e.message, current: 0, total: 0 });
    }
}
