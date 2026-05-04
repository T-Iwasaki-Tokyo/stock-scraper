import { NextResponse } from 'next/server';

export async function POST() {
    const GITHUB_TOKEN = process.env.GITHUB_ACCESS_TOKEN;
    const REPO_OWNER = 'T-Iwasaki-Tokyo';
    const REPO_NAME = 'stock-scraper';
    const WORKFLOW_ID = 'scrape.yml';

    if (!GITHUB_TOKEN) {
        return NextResponse.json({ error: 'GitHubトークンが設定されていません。' }, { status: 500 });
    }

    try {
        console.log(`[Stop] Looking for running workflows in ${REPO_OWNER}/${REPO_NAME}...`);
        
        // 1. 実行中のワークフロー一覧を取得
        const runsResponse = await fetch(
            `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/runs?status=in_progress`,
            {
                headers: {
                    'Authorization': `Bearer ${GITHUB_TOKEN}`,
                    'Accept': 'application/vnd.github+json',
                    'X-GitHub-Api-Version': '2022-11-28',
                },
            }
        );

        if (!runsResponse.ok) {
            throw new Error(`GitHub APIエラー(List): ${runsResponse.status}`);
        }

        const runsData = await runsResponse.json();
        const activeRuns = runsData.workflow_runs || [];

        if (activeRuns.length === 0) {
            // 実行中がない場合は queued も確認
            const queuedResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/workflows/${WORKFLOW_ID}/runs?status=queued`,
                {
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                }
            );
            const queuedData = await queuedResponse.json();
            activeRuns.push(...(queuedData.workflow_runs || []));
        }

        if (activeRuns.length === 0) {
            return NextResponse.json({ message: '実行中のプロセスは見つかりませんでした。' });
        }

        // 2. すべての実行中のジョブをキャンセル
        let cancelledCount = 0;
        for (const run of activeRuns) {
            console.log(`[Stop] Cancelling run ID: ${run.id}...`);
            const cancelResponse = await fetch(
                `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/actions/runs/${run.id}/cancel`,
                {
                    method: 'POST',
                    headers: {
                        'Authorization': `Bearer ${GITHUB_TOKEN}`,
                        'Accept': 'application/vnd.github+json',
                        'X-GitHub-Api-Version': '2022-11-28',
                    },
                }
            );

            if (cancelResponse.ok) {
                cancelledCount++;
            }
        }

        return NextResponse.json({ 
            message: `${cancelledCount} 件のプロセスを停止しました。`,
            count: cancelledCount 
        });

    } catch (e: any) {
        console.error('[Error] Failed to stop GitHub Action:', e.message);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
