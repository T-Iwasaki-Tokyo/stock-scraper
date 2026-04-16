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
    
    // 移動平均線 (Kabutan)
    if (stock.ma5_val !== undefined) data.ma5_val = stock.ma5_val;
    if (stock.ma5_diff !== undefined) data.ma5_diff = stock.ma5_diff;
    if (stock.ma25_val !== undefined) data.ma25_val = stock.ma25_val;
    if (stock.ma25_diff !== undefined) data.ma25_diff = stock.ma25_diff;

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

    const { search } = config.current || config;
    
    // 検索フォームページへ移動
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'networkidle' });

    // --- 検索条件入力 ---
    
    // 権利確定月: 一旦すべて解除してからチェック
    await page.click('.clear-all'); // 「すべて選択/解除」ボタン
    if (search.months?.length) {
        for (const month of search.months) {
            await page.check(`input[name="fm"][value="${month}"]`);
        }
    }

    // おすすめ度 (st)
    if (search.minRecommendation) {
        await page.selectOption('select[name="st"]', search.minRecommendation);
    }

    // 投資金額 (mpf, mpt)
    if (search.minAmount) await page.selectOption('select[name="mpf"]', search.minAmount);
    if (search.maxAmount) await page.selectOption('select[name="mpt"]', search.maxAmount);

    // 利回り (下限のみセット)
    if (search.minYieldYutai) await page.selectOption('select[name="pyf"]', search.minYieldYutai);
    if (search.minYieldDividend) await page.selectOption('select[name="dyf"]', search.minYieldDividend);
    if (search.minYieldTotal) await page.selectOption('select[name="tyf"]', search.minYieldTotal);

    // カテゴリ: 一旦すべて解除してからチェック
    // サイトの「すべて選択/解除」は月と共通のクエリセレクタで動く可能性があるため、個別に処理
    const categories = search.categories || [];
    if (categories.length > 0) {
        // カテゴリのチェックボックスをすべて外す（カテゴリセクション内のものを特定して外すのが正解だが、一旦愚直にやる）
        const catCheckboxes = await page.$$('input[name="cat"]');
        for (const cb of catCheckboxes) {
            if (await cb.isChecked()) await cb.uncheck();
        }
        for (const catId of categories) {
            await page.check(`input[name="cat"][value="${catId}"]`);
        }
    }

    // 長期保有特典 (lp, lpo)
    if (search.longTerm === 'exists') {
        await page.check('input[name="lp"][value="1"]');
    } else if (search.longTerm === 'only') {
        await page.check('input[name="lp"][value="1"]');
        await page.check('input[name="lpo"]');
    } else if (search.longTerm === 'none') {
        await page.check('input[name="lp"][value="2"]');
    } else {
        await page.check('input[name="lp"][value=""]'); // 全銘柄
    }

    // 信用区分 (cl)
    if (search.creditTrading === 'standard') {
        await page.check('input[name="cl"][value="制度信用銘柄"]');
    } else if (search.creditTrading === 'loan') {
        await page.check('input[name="cl"][value="貸借銘柄"]');
    } else {
        await page.check('input[name="cl"][value=""]'); // 全銘柄
    }

    // 疑義注記 (dn)
    if (search.includeGoingConcern === 'include') {
        await page.check('input[name="dn"][value="1"]');
    } else if (search.includeGoingConcern === 'exclude') {
        await page.check('input[name="dn"][value="-1"]');
    } else {
        await page.check('input[name="dn"][value=""]'); // 全銘柄
    }

    // 「この条件で検索する」ボタンをクリック
    // サイトの実装に合わせる（input[type="image"] or button）
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'networkidle' }),
        page.click('input[name="btn"]')
    ]);

    // スクリーンショット撮影
    await page.screenshot({ path: 'public/screenshots/last_search.png', fullPage: true });
    console.log('[Phase 1] 検索結果スクリーンショット保存完了');

    // --- 結果解析 ---
    let allStocks = [];
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
                const descEl = item.querySelector('.yutai_content_text');
                
                const pTags = Array.from(item.querySelectorAll('p'));
                const pickYield = (labelText) => {
                    const p = pTags.find(el => el.innerText.includes(labelText));
                    if (!p) return 'N/A';
                    const span = p.querySelector('.tousi_price');
                    if (!span) return 'N/A';
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
                    yutai_desc: descEl ? descEl.innerText.trim() : '',
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
        
        // --- Yahoo Finance データの抽出 ---
        const yahooDetails = await page.evaluate(() => {
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

        // --- 株探 (Kabutan) データの抽出 ---
        let kabutanDetails = { ma5_val: 'N/A', ma5_diff: 'N/A', ma25_val: 'N/A', ma25_diff: 'N/A' };
        try {
            await page.goto(`https://kabutan.jp/stock/?code=${code}`, { waitUntil: 'domcontentloaded' });
            await page.waitForSelector('.stock_table', { timeout: 10000 });
            
            kabutanDetails = await page.evaluate(() => {
                const rows = Array.from(document.querySelectorAll('tr'));
                const extractMA = (label) => {
                    const row = rows.find(r => r.innerText.includes(label));
                    if (!row) return { val: 'N/A', diff: 'N/A' };
                    const cells = Array.from(row.querySelectorAll('td'));
                    if (cells.length < 2) return { val: 'N/A', diff: 'N/A' };
                    
                    const valText = cells[0].innerText.replace(/,/g, '').match(/[0-9.]+/);
                    const diffText = cells[1].innerText.match(/[+-]?[0-9.]+/);
                    
                    return {
                        val: valText ? valText[0] : 'N/A',
                        diff: diffText ? diffText[0] : 'N/A'
                    };
                };

                const ma5 = extractMA('5日線');
                const ma25 = extractMA('25日線');
                
                return {
                    ma5_val: ma5.val,
                    ma5_diff: ma5.diff,
                    ma25_val: ma25.val,
                    ma25_diff: ma25.diff
                };
            });
        } catch (ke) {
            console.warn(`[Warn] Kabutan fetch failed for ${code}:`, ke.message);
        }

        const stockData = {
            code,
            ...yahooDetails,
            ...kabutanDetails,
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
        console.log('[Start] 実行開始...');
        
        // 現在の設定を Supabase から取得
        const { data: configRows, error: configError } = await supabase
            .from('configs')
            .select('*')
            .eq('is_current', true)
            .single();

        if (configError) {
            console.error('[Error] Config fetch failed:', configError.message);
            process.exit(1);
        }

        const config = configRows;
        let list = [];

        if (config.mode === 'file') {
            console.log('[Mode] ファイル読み込みモード');
            const { data: targetStocks, error: targetError } = await supabase
                .from('target_stocks')
                .select('code, name');
            
            if (targetError) {
                console.error('[Error] Target stocks fetch failed:', targetError.message);
                process.exit(1);
            }

            list = (targetStocks || []).map(s => ({
                code: s.code,
                name: s.name,
                status: 'pending'
            }));
        } else {
            console.log('[Mode] 条件検索モード');
            list = await fetchStockList(config);
        }

        console.log(`[Process] ${list.length} 件の銘柄を処理します...`);
        
        for (let i = 0; i < list.length; i++) {
            const s = list[i];
            console.log(`[${i + 1}/${list.length}] ${s.name} (${s.code}) を取得中...`);
            try {
                await fetchStockDetail(s.code);
            } catch (e) {
                console.error(`[Error] Detail fetch failed for ${s.code}:`, e.message);
            }
            
            if (i < list.length - 1) {
                const waitMinutes = config.scraping?.intervalMinutes || 1;
                console.log(`[Wait] ${waitMinutes} 分間待機します...`);
                await new Promise(r => setTimeout(r, waitMinutes * 60 * 1000));
            }
        }
        
        console.log('[End] すべての処理が完了しました');
    })();
}
