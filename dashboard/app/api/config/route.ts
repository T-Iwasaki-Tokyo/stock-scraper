import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
    const filePath = path.join(process.cwd(), 'config.json');
    const config = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    return NextResponse.json(config);
}

export async function POST(request: Request) {
    const body = await request.json();
    const filePath = path.join(process.cwd(), 'config.json');
    fs.writeFileSync(filePath, JSON.stringify(body, null, 2));
    return NextResponse.json({ success: true });
}
