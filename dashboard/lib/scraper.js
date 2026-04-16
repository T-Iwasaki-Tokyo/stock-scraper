import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY // 書き込み権限あり
);

export async function getBrowser() {
    return await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage']
    });
}

// データを Supabase へ UPSERT（追加または更新）
async function upsertStock(stock) {
    const data = {
        code: stock.code,
        updated_at: new Date().toISOString()
    };

    if (stock.name) data.name = stock.name;
    if (stock.price !== undefined) data.price = stock.price !== '取得中...' ? stock.price : null;
    if (stock.totalYield !== undefined) data.total_yield = stock.totalYield;
    if (stock.dividendYield !== undefined) data.dividend_yield = stock.dividendYield !== '待機中...' ? stock.dividendYield : null;
    if (stock.yutaiYield !== undefined) data.yutai_yield = stock.yutaiYield;
    if (stock.pbr !== undefined) data.pbr = stock.pbr !== '待機中...' ? stock.pbr : null;
    if (stock.status) data.status = stock.status;
    if (stock.yahooUrl) data.yahoo_url = stock.yahooUrl;
    if (stock.chartUrl) data.chart_url = stock.chartUrl;

    const { error } = await supabase
        .from('stocks')
        .upsert(data, { onConflict: 'code' });
    
    if (error) console.error(`[Error] Supabase UPSERT failed for ${stock.code}:`, error.message);
}

// Phase 1: 銘柄リスト & 総合利回り取得
export async function fetchStockList(config) {
    console.log('[Phase 1] 銘柄リスト取得開始...');
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

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
    
    let allStocks = [];
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    
    while (true) {
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
                
                const pTags = Array.from(item.querySelectorAll('p'));
                const pickYield = (labelText) => {
                    const p = pTags.find(el => el.innerText.includes(labelText));
                    if (!p) return 'N/A';
                    const span = p.querySelector('.tousi_price');
                    if (!span) return 'N/A';
                    // 数値部分のみを抽出して正規化（%が含まれていても外す）
                    const val = span.innerText.trim();
                    const match = val.match(/[0-9.]+/);
                    return match ? match[0] : 'N/A';
                };

                return {
                    name: nameLink ? nameLink.innerText.trim() : '不明',
                    code: codeSpan ? codeSpan.innerText.trim() : null,
                    totalYield: tyEl ? (tyEl.innerText.match(/[0-9.]+/) || ['N/A'])[0] : 'N/A',
                    dividendYield: pickYield('【予想配当利回り】'),
                    yutaiYield: pickYield('【優待利回り】'),
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
            await new Promise(r => setTimeout(r, 2000));
        } else {
            break;
        }
    }

    await browser.close();
    const finalStocks = Array.from(new Map(allStocks.map(s => [s.code, s])).values()).slice(0, config.scraping.maxStocks);
    
    // Supabase へ全リストを一旦保存
    for (const s of finalStocks) {
        await upsertStock(s);
    }

    return finalStocks;
}

// Phase 2: 銘柄詳細取得
export async function fetchStockDetail(code) {
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    try {
        await page.goto(`https://finance.yahoo.co.jp/quote/${code}.T`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('body', { timeout: 10000 });
        await new Promise(r => setTimeout(r, 2000));

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
            return {
                price: priceEl ? pickNumber(priceEl.innerText) : 'N/A',
                pbr: pickNumber(getVal('PBR'))
            };
        });

        const stockData = {
            code,
            ...details,
            yahooUrl: `https://finance.yahoo.co.jp/quote/${code}.T`,
            chartUrl: `https://finance.yahoo.co.jp/quote/${code}.T/chart`,
            status: 'complete'
        };

        // Supabase 更新
        await upsertStock(stockData);

        await browser.close();
        return stockData;
    } catch (e) {
        await browser.close();
        throw e;
    }
}

// GitHub Actions 等でコマンドラインからも実行可能なようにエントリポイントを用意
if (process.argv[1]?.endsWith('scraper.js')) {
    (async () => {
        const config = JSON.parse(fs.readFileSync('./config.json', 'utf-8'));
        const list = await fetchStockList(config);
        for (const s of list) {
            await fetchStockDetail(s.code);
            await new Promise(r => setTimeout(r, 60000)); // 1分待機
        }
    })();
}
