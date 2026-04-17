import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
dotenv.config({ path: '.env.local' });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error('[Critical] Supabase configuration (URL or Service Role Key) is missing in environment variables.');
    process.exit(1);
}

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
    if (stock.ma5 !== undefined) data.ma5 = stock.ma5;
    if (stock.ma25 !== undefined) data.ma25 = stock.ma25;

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
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });

    // 1. 権利確定月 (fm[])
    const targetMonths = search.months || [];
    for (const m of targetMonths) {
        const labelText = `${m}月`;
        const labelSelector = `label:has-text("${labelText}")`;
        try {
            if (await page.locator(labelSelector).isVisible()) {
                await page.click(labelSelector);
            }
        } catch (e) {
            console.warn(`[Warn] Could not click month label for ${m}:`, e.message);
        }
    }

    // 2. カテゴリ (cat_group)
    const targetCategories = search.categories || [];
    for (const catVal of targetCategories) {
        try {
            // catVal (例: "その他5") に合致するinputを特定し、その親ラベルをクリックする
            const inputSelector = `input[name="cat_group"][value="${catVal}"]`;
            const label = page.locator(inputSelector).locator('xpath=..');
            if (await label.isVisible()) {
                await label.click();
            }
        } catch (e) {
            console.warn(`[Warn] Could not select category ${catVal}:`, e.message);
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

    // --- スクリーンショット撮影（検索条件入力後・検索実行前） ---
    // 反映を確実にするため少し待機
    await page.waitForTimeout(500);
    const screenshotPath = 'public/screenshots/last_search.png';
    await page.screenshot({ path: screenshotPath, fullPage: true });

    try {
        const fileContent = fs.readFileSync(screenshotPath);
        
        // バケットが存在するか確認（なければ作成）
        const { data: buckets } = await supabase.storage.listBuckets();
        if (!buckets?.find(b => b.name === 'screenshots')) {
            await supabase.storage.createBucket('screenshots', { public: true });
        }

        const { error: uploadError } = await supabase.storage.from('screenshots').upload('last_search.png', fileContent, {
            contentType: 'image/png',
            upsert: true
        });

        if (uploadError) {
            console.error('[Error] Failed to upload screenshot to Supabase Storage:', uploadError.message);
        } else {
            console.log('[Phase 1] 検索条件画面のスクリーンショットを Supabase Storage にアップロードしました');
        }
    } catch (err) {
        console.error('[Error] File read or unexpected error during screenshot upload:', err);
    }

    // 「この条件で検索する」ボタンをクリック (UI変更に対応)
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }),
        page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const btn = links.find(a => a.innerText.includes('この条件で検索する') && a.offsetWidth > 0 && a.offsetHeight > 0);
            if (btn) {
                btn.click();
            } else {
                // フォールバック: input[name="btn"] が存在すればそれを使う
                const fallbackBtn = Array.from(document.querySelectorAll('input[name="btn"]')).find(el => el.offsetWidth > 0 && el.offsetHeight > 0);
                if (fallbackBtn) fallbackBtn.click();
            }
        })
    ]);

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
                    // ラベル文字の間に空白があってもマッチするように正規表現を作成
                    const regex = new RegExp('【\\s*' + labelText + '\\s*】');
                    const p = pTags.find(el => regex.test(el.innerText));
                    if (!p) return 'N/A';
                    const span = p.querySelector('.tousi_price');
                    if (!span) return 'N/A';
                    const val = span.innerText.trim();
                    // 数値と全角・半角の％を取得
                    const match = val.match(/[0-9.]+[%％]?/);
                    return match ? match[0] : 'N/A';
                };

                const getVal = (selectors) => {
                    for (const sel of selectors) {
                        const el = item.querySelector(sel);
                        if (el) {
                            const text = el.innerText.trim();
                            if (/[0-9.]+/.test(text)) {
                                const m = text.match(/[0-9.]+[%％]?/);
                                return m ? m[0] : null;
                            }
                        }
                    }
                    return 'N/A';
                };

                return {
                    name: nameLink ? nameLink.innerText.trim() : '不明',
                    code: codeSpan ? codeSpan.innerText.trim() : null,
                    totalYield: getVal(['[data-js="ty"]', '.rima_num']),
                    dividendYield: pickYield('予想配当利回り'),
                    yutaiYield: pickYield('優待利回り'),
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
    
    // --- クリーンアップ: 新しい検索結果を入れる前に古いデータを削除 ---
    console.log(`[Phase 1] 既存のデータを削除しています...`);
    const { error: deleteError } = await supabase.from('stocks').delete().neq('code', '');
    if (deleteError) {
        console.error('[Error] Failed to clear stocks table:', deleteError.message);
    }

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
        // --- 1. Yahoo Finance ---
        await page.goto(`https://finance.yahoo.co.jp/quote/${code}.T`, { waitUntil: 'domcontentloaded' });
        await page.waitForSelector('body', { timeout: 10000 });
        
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
                pbr: pickNumber(getVal('PBR')),
                dividendYield: pickNumber(getVal('配当利回り'))
            };
        });

    // --- 2. 詳細情報補完 (Phase 2) ---
    async function fetchStockDetail(code) {
        let browser;
        try {
            browser = await chromium.launch({ headless: true });
            const page = await browser.newPage();
            const foundDetails = {};

            // --- 2-1. 楽しい株主優待＆配当 (利回り補完) ---
            try {
                await page.goto(`https://www.kabuyutai.com/tool/index.php?code=${code}&btn=%E3%81%93%E3%81%AE%E6%9D%A1%E4%BB%B6%E3%81%A7%E6%A4%9C%E7%B4%A2%E3%81%99%E3%82%8B`, { waitUntil: 'load' });
                await page.waitForSelector('.table_tr', { timeout: 10000 }).catch(() => {});
                
                const yutaiDetails = await page.evaluate(() => {
                const item = document.querySelector('.table_tr');
                if (!item) return { yutaiYield: 'N/A', totalYield: 'N/A', yutai_desc: '' };

                const tyEl = item.querySelector('[data-js="ty"]') || item.querySelector('.rima_num');
                const descEl = item.querySelector('.yutai_content_text');
                const yutaiDetails = await page.evaluate(() => {
                    const item = document.querySelector('.table_tr');
                    if (!item) return null;

                    const pickYield = (labelText) => {
                        const regex = new RegExp('【\\s*' + labelText + '\\s*】');
                        const p = Array.from(item.querySelectorAll('p')).find(el => regex.test(el.innerText));
                        if (!p) return null;
                        const span = p.querySelector('.tousi_price');
                        if (!span) return null;
                        const val = span.innerText.trim();
                        const match = val.match(/[0-9.]+[%％]?/);
                        return match ? match[0] : null;
                    };

                    const getVal = (selectors) => {
                        for (const sel of selectors) {
                            const el = item.querySelector(sel);
                            if (el) {
                                const text = el.innerText.trim();
                                if (/[0-9.]+/.test(text)) {
                                    const m = text.match(/[0-9.]+[%％]?/);
                                    return m ? m[0] : null;
                                }
                            }
                        }
                        return null;
                    };

                    return {
                        totalYield: getVal(['[data-js="ty"]', '.rima_num']),
                        yutaiYield: pickYield('優待利回り'),
                        yutai_desc: item.querySelector('.yutai_content_text')?.innerText.trim()
                    };
                });
                if (yutaiDetails) {
                    // 値が取れたものだけマージする
                    if (yutaiDetails.totalYield) foundDetails.totalYield = yutaiDetails.totalYield;
                    if (yutaiDetails.yutaiYield) foundDetails.yutaiYield = yutaiDetails.yutaiYield;
                    if (yutaiDetails.yutai_desc) foundDetails.yutai_desc = yutaiDetails.yutai_desc;
                }
            });
        } catch (ye) {
            console.warn(`[Warn] Kabuyutai fetch failed for ${code}:`, ye.message);
        }

        // --- 3. 株探 (Kabutan) ---
        let kabutanDetails = { ma5: 'N/A', ma25: 'N/A' };
        try {
            await page.goto(`https://kabutan.jp/stock/?code=${code}`, { waitUntil: 'domcontentloaded' });
            // .stock_table は無くなったため、テーブル要素から直接探す
            kabutanDetails = await page.evaluate(() => {
                const results = { ma5_val: null, ma5_diff: null, ma25_val: null, ma25_diff: null };
                
                // 株探の表から5日・25日線を探す (各td/thを走査)
                const allCells = Array.from(document.querySelectorAll('td, th'));
                
                const getMAData = (keyword) => {
                    const nameCell = allCells.find(el => el.innerText.includes(keyword));
                    if (!nameCell) return null;
                    
                    const row = nameCell.parentElement;
                    const nextRow = row?.nextElementSibling;
                    if (!row || !nextRow) return null;
                    
                    // 現在の行でのインデックスを特定
                    const index = Array.from(row.cells).indexOf(nameCell);
                    if (index === -1) return null;
                    
                    // 次の行の同じ位置にある数値を取得
                    const valCell = nextRow.cells[index];
                    return valCell ? valCell.innerText.trim() : null;
                };

                const ma5Str = getMAData('5日線');
                const ma25Str = getMAData('25日線');

                const priceText = document.querySelector('.stock_price')?.innerText || '';
                const price = parseFloat(priceText.replace(/,/g, ''));

                if (ma5Str && price) {
                    const ma5 = parseFloat(ma5Str.replace(/,/g, ''));
                    if (ma5) {
                        results.ma5_val = ma5;
                        results.ma5_diff = parseFloat(((price - ma5) / ma5 * 100).toFixed(2));
                    }
                }
                if (ma25Str && price) {
                    const ma25 = parseFloat(ma25Str.replace(/,/g, ''));
                    if (ma25) {
                        results.ma25_val = ma25;
                        results.ma25_diff = parseFloat(((price - ma25) / ma25 * 100).toFixed(2));
                    }
                }
                return results;
            });
        } catch (ke) {
            console.warn(`[Warn] Kabutan fetch failed for ${code}:`, ke.message);
        }

        const stockData = {
            code,
            ...yahooDetails,
            ...foundDetails, // N/Aを含まない、実際に取得できた詳細のみ上書き
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
        if (browser) await browser.close();
        throw e;
    }
}

// GitHub Actions 等でコマンドラインからも実行可能なようにエントリポイントを用意
if (process.argv[1]?.endsWith('scraper.js')) {
    (async () => {
        try {
            console.log('==================================================');
            console.log('[Start] Stock Scraper Automation 実行開始');
            console.log(`[Time] ${new Date().toLocaleString('ja-JP')}`);
            console.log('==================================================');
            
            // 現在の設定を Supabase から取得
            console.log('[1/4] 設定を取得中...');
            const { data: configRows, error: configError } = await supabase
                .from('configs')
                .select('*')
                .eq('is_current', true)
                .single();

            if (configError) {
                console.error('[Error] 設定の取得に失敗しました:', configError.message);
                process.exit(1);
            }

            const config = configRows;
            let list = [];

            if (config.mode === 'file') {
                console.log('[2/4] モード: ファイル読み込み');
                const { data: targetStocks, error: targetError } = await supabase
                    .from('target_stocks')
                    .select('code, name');
                
                if (targetError) {
                    console.error('[Error] 銘柄リストの取得に失敗しました:', targetError.message);
                    process.exit(1);
                }

                list = (targetStocks || []).map(s => ({
                    code: s.code,
                    name: s.name,
                    status: 'pending'
                }));
            } else {
                console.log('[2/4] モード: 条件検索');
                list = await fetchStockList(config);
            }

            console.log(`[3/4] ${list.length} 件の銘柄を処理対象として認識しました`);
            
            for (let i = 0; i < list.length; i++) {
                const s = list[i];
                console.log(`      (${i + 1}/${list.length}) ${s.name} (${s.code}) を詳細取得中...`);
                try {
                    await fetchStockDetail(s.code);
                } catch (e) {
                    console.error(`      [Warn] ${s.code} の取得に失敗しました:`, e.message);
                }
                
                if (i < list.length - 1) {
                    const waitMinutes = config.scraping?.intervalMinutes || 1;
                    const waitMs = waitMinutes * 60 * 1000;
                    console.log(`      -> 次の銘柄まで ${waitMinutes} 分待機します...`);
                    await new Promise(r => setTimeout(r, waitMs));
                }
            }
            
            console.log('==================================================');
            console.log('[4/4] すべての処理が完了しました');
            console.log(`[End] 終了時刻: ${new Date().toLocaleString('ja-JP')}`);
            console.log('==================================================');
            process.exit(0);
        } catch (globalError) {
            console.error('==================================================');
            console.error('[Critical Error] 実行中に致命的なエラーが発生しました');
            console.error(globalError);
            console.error('==================================================');
            process.exit(1);
        }
    })();
}
