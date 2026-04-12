import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

// プロジェクトルートのresults.jsonのパスを解決
const RESULTS_PATH = path.join(process.cwd(), '..', 'results.json');

export async function GET() {
  try {
    if (!fs.existsSync(RESULTS_PATH)) {
      return NextResponse.json([]);
    }
    const data = fs.readFileSync(RESULTS_PATH, 'utf-8');
    return NextResponse.json(JSON.parse(data));
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to read results', details: error.message }, { status: 500 });
  }
}
