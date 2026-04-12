import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// プロジェクトルートのconfig.jsonのパスを解決
const CONFIG_PATH = path.join(process.cwd(), '..', 'config.json');

export async function GET() {
  try {
    const data = fs.readFileSync(CONFIG_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to read config', details: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const newConfig = await req.json();
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(newConfig, null, 2));
    return NextResponse.json({ message: 'Config updated successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update config', details: error.message }, { status: 500 });
  }
}
