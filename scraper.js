import { chromium } from 'playwright';
import fs from 'fs';

const CONFIG_PATH = './config.json';
const RESULTS_PATH = './results.json';
const STATUS_PATH = './status.json';

async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function saveResults(results) {
    fs.writeFileSync(RESULTS_PATH, JSON.stringify(results, null, 2));
}

function updateStatus(status) {
    fs.writeFileSync(STATUS_PATH, JSON.stringify({ ...status, updatedAt: new Date().toISOString() }, null, 2));
}

async function run() {
    const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    console.log('--- 究極版スクレイパー V6: ステータス連携モード開始 ---');
    
    updateStatus({ phase: 'searching', message: '銘柄リストを抽出しています', current: 0, total: 0 });

    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // --- PHASE 1: 銘柄リスト & 総合利回り ---
    const { search } = config;
    const params = new URLSearchParams();
    if (search.months?.length) params.set('fm', search.months.join(','));
    if (search.categories?.length) params.set('cat', search.categories.join(','));
    params.set('mp', `${search.minAmount || ''},${search.maxAmount || ''}`);
    params.set('st', search.minRecommendation || '');
    params.set('ty', `${search.minYieldTotal || ''},`);
    params.set('dy', `${search.minYieldDividend || ''},`);
    params.set('py', `${search.minYieldYutai || ''},`);
    
    if (search.longTerm === 'only') params.set('lpo', '2');
    else if (search.longTerm === 'exists') params.set('lp', '1');
    if (search.creditTrading === 'standard') params.set('sk', '1');
    else if (search.creditTrading === 'loan') params.set('lk', '1');

    const searchUrl = `https://www.kabuyutai.com/tool/shiborikomi/?${params.toString()}`;
    console.log(`[Phase 1] 銘柄リスト構築中...`);
    
    let allStocks = [];
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    let pageNum = 1;
    while (true) {
        console.log(`   ページ ${pageNum} をスキャン中...`);
        try {
            await page.waitForSelector('.table_tr', { timeout: 10000 });
        } catch (e) {
            break;
        }

        const stocks = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.table_tr')).map(item => {
                const nameLink = item.querySelector('[data-js="company"]');
                const codeSpan = item.querySelector('[data-js="code"]');
                const tyEl = item.querySelector('[data-js="ty"]') || item.querySelector('.rima_num');
                return {
                    name: nameLink ? nameLink.innerText.trim() : '不明',
                    code: codeSpan ? codeSpan.innerText.trim() : null,
                    totalYield: tyEl ? tyEl.innerText.trim() : 'N/A',
                    dividendYield: '待機中...',
                    price: '取得中...',
                    pbr: '待機中...',
                    status: 'waiting'
                };
            }).filter(s => s.code);
        });

        allStocks.push(...stocks);
        if (allStocks.length >= (config.scraping.maxStocks || 9999)) break;

        const next = page.locator('a.js-page-next').first();
        if (await next.isVisible()) {
            const isDisabled = await next.evaluate(el => el.classList.contains('disabled'));
            if (isDisabled) break;
            await next.click();
            await sleep(2000);
            pageNum++;
        } else {
            break;
        }
    }

    allStocks = Array.from(new Map(allStocks.map(s => [s.code, s])).values()).slice(0, config.scraping.maxStocks);
    saveResults(allStocks);
    console.log(`[Phase 1] 完了: ${allStocks.length} 件登録`);

    // --- PHASE 2: 詳細 (Deep Extract) ---
    updateStatus({ phase: 'fetching', message: '各銘柄の詳細情報を取得しています', current: 0, total: allStocks.length });
    
    for (let i = 0; i < allStocks.length; i++) {
        const stock = allStocks[i];
        process.stdout.write(`[${i+1}/${allStocks.length}] ${stock.name} (${stock.code}) ... `);
        
        try {
            updateStatus({ phase: 'fetching', message: `${stock.name} (${stock.code}) を取得中`, current: i + 1, total: allStocks.length });
            
            await page.goto(`https://finance.yahoo.co.jp/quote/${stock.code}.T`, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('body', { timeout: 10000 });
            await sleep(1500);

            const details = await page.evaluate(() => {
                const pickNumber = (text) => {
                    if (!text) return 'N/A';
                    const m = text.match(/[0-9,.]+/);
                    return m ? m[0].replace(/,/g, '') : 'N/A';
                };
                const getVal = (labelText) => {
                    const dts = Array.from(document.querySelectorAll('dt'));
                    const targetDt = dts.find(dt => dt.innerText.includes(labelText));
                    if (!targetDt) return 'N/A';
                    const dd = targetDt.nextElementSibling;
                    return dd ? dd.innerText : 'N/A';
                };
                const priceEl = document.querySelector('[class*="PriceBoard__price"]');
                const priceVal = priceEl ? pickNumber(priceEl.innerText) : 'N/A';
                return {
                    price: priceVal,
                    dividendYield: pickNumber(getVal('配当利回り')),
                    pbr: pickNumber(getVal('PBR'))
                };
            });

            allStocks[i] = {
                ...stock,
                ...details,
                chartUrl: `https://finance.yahoo.co.jp/quote/${stock.code}.T/chart`,
                yahooUrl: `https://finance.yahoo.co.jp/quote/${stock.code}.T`,
                timestamp: new Date().toLocaleString('ja-JP'),
                status: 'complete'
            };
            
            saveResults(allStocks);
            console.log(`成功`);
        } catch (e) {
            console.log(`失敗: ${e.message}`);
        }

        if (i < allStocks.length - 1) {
            await sleep(config.scraping.intervalMinutes * 60 * 1000);
        }
    }

    updateStatus({ phase: 'completed', message: 'すべての情報の取得が完了しました', current: allStocks.length, total: allStocks.length });
    console.log(`\n全銘柄の取得が完了しました。`);
    await browser.close();
}

run();
