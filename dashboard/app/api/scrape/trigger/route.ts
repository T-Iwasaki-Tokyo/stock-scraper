import { NextResponse } from 'next/server';

export async function POST() {
    const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
    // リポジトリ情報はメタデータから取得: T-Iwasaki-Tokyo/stock-scraper
    const REPO_OWNER = 'T-Iwasaki-Tokyo';
    const REPO_NAME = 'stock-scraper';
    const WORKFLOW_ID = 'scrape.yml'; // .github/workflows/scrape.yml のファイル名

    if (!GITHUB_TOKEN) {
        console.error('[Error] GITHUB_ACCESS_TOKEN is not configured in environment variables.');
        return NextResponse.json({ error: 'GitHubトークンが設定されていません。Vercelの環境変数に GITHUB_ACCESS_TOKEN を追加してください。' }, { status: 500 });
    }

    try {
        console.log(`[Trigger] Requesting GitHub Action for ${REPO_OWNER}/${REPO_NAME}...`);
        
        const response = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/dispatches`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
                body: JSON.stringify({
                    ref: 'main', 
                }),
            }
        );

        if (!response.ok) {
            const errorBody = await response.text();
            console.error(`[Error] GitHub API responded with ${response.status}:`, errorBody);
            throw new Error(`GitHub APIエラー: ${response.status} ${errorBody}`);
        }

        console.log('[Success] GitHub Action triggered successfully.');
        return NextResponse.json({ message: 'GitHub Actionsを起動しました。巡回が開始されます。' });
    } catch (e: any) {
        console.error('[Error] Failed to trigger GitHub Action:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
