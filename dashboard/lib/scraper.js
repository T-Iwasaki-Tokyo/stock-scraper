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
    if (stock.yutai_desc) data.yutai_desc = stock.yutai_desc;
    if (stock.status) data.status = stock.status;
    if (stock.yahooUrl) data.yahoo_url = stock.yahooUrl;
    if (stock.chartUrl) data.chart_url = stock.chartUrl;
    
    // 移動平均線 (Kabutan)
    if (stock.ma5_diff !== undefined) data.ma5_diff = stock.ma5_diff;
    if (stock.ma5_trend !== undefined) data.ma5_trend = stock.ma5_trend;
    if (stock.ma25_diff !== undefined) data.ma25_diff = stock.ma25_diff;
    if (stock.ma25_trend !== undefined) data.ma25_trend = stock.ma25_trend;
    
    // Yahoo 追加項目
    if (stock.dividend_per_share !== undefined) data.dividend_per_share = stock.dividend_per_share !== 'N/A' ? parseFloat(stock.dividend_per_share) : null;
    if (stock.yearly_high !== undefined) data.yearly_high = stock.yearly_high !== 'N/A' ? parseFloat(stock.yearly_high) : null;
    if (stock.yearly_low !== undefined) data.yearly_low = stock.yearly_low !== 'N/A' ? parseFloat(stock.yearly_low) : null;
    if (stock.minkabu_url) data.minkabu_url = stock.minkabu_url;
    if (stock.sbi_trend) data.sbi_trend = stock.sbi_trend;
    if (stock.shares !== undefined) data.shares = stock.shares;
    if (stock.avg_price !== undefined) data.avg_price = stock.avg_price;

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
                    // 数値のみを取得（％記号は除外）
                    const match = val.match(/[0-9.]+/);
                    return match ? match[0] : 'N/A';
                };

                const getVal = (selectors) => {
                    for (const sel of selectors) {
                        const el = item.querySelector(sel);
                        if (el) {
                            const text = el.innerText.trim();
                            const m = text.match(/[0-9.]+/);
                            if (m) {
                                return m[0];
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
export async function fetchStockDetail(code, name) {
    const browser = await getBrowser();
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    // ブラウザ内のコンソール出力を Node.js の標準出力に転送
    page.on('console', (msg) => {
        const text = msg.text();
        if (text.includes('[Debug]')) {
            console.log(text);
        }
    });

    try {
        // --- 1. Yahoo Finance (Retry導入) ---
        let yahooDetails = { price: 'N/A', pbr: 'N/A', dividendYield: 'N/A', dividend_per_share: 'N/A', yearly_high: 'N/A', yearly_low: 'N/A' };
        let attempts = 0;
        const maxAttempts = 5;

        while (attempts < maxAttempts) {
            try {
                attempts++;
                if (attempts > 1) {
                    console.log(`      [Retry] Yahoo Finance 再試行中 (${attempts}/${maxAttempts})...`);
                    await page.waitForTimeout(3000);
                }
                
                await page.goto(`https://finance.yahoo.co.jp/quote/${code}.T`, { waitUntil: 'domcontentloaded', timeout: 30000 });
                // データの出現を確実にするため待機
                await Promise.all([
                    page.waitForSelector('[class*="PriceBoard__price"], ._3M-vTqfI', { timeout: 15000 }).catch(() => {}),
                    page.waitForSelector('dt, th', { timeout: 10000 }).catch(() => {})
                ]);

                yahooDetails = await page.evaluate(() => {
                    const pickNumber = (text) => {
                        if (!text || text === '---') return 'N/A';
                        const m = text.match(/[0-9,.]+/);
                        return m ? m[0].replace(/,/g, '') : 'N/A';
                    };
                    const getVal = (labelText) => {
                        const allCells = Array.from(document.querySelectorAll('dt, th'));
                        const target = allCells.find(el => el.innerText.includes(labelText));
                        if (!target) {
                            const sample = allCells.slice(0, 15).map(el => el.innerText.trim()).filter(t => t).join(' | ');
                            console.log(`[Debug] Yahoo: "${labelText}" NOT found. Available (first 15): ${sample}`);
                            return 'N/A';
                        }
                        const valEl = target.nextElementSibling;
                        if (!valEl) return 'N/A';
                        const specificVal = valEl.querySelector('[class*="value"], [class*="Number__value"]');
                        const valText = (specificVal || valEl).innerText.trim();
                        console.log(`[Debug] Yahoo: "${labelText}" found. Value text: "${valText}"`);
                        return valText;
                    };
                    const priceEl = document.querySelector('[class*="PriceBoard__price"], ._3M-vTqfI, ._2S_1t3_Z, ._3rXWJK9P, ._1mD3hY0h');
                    return {
                        price: priceEl ? pickNumber(priceEl.innerText) : 'N/A',
                        pbr: pickNumber(getVal('PBR')),
                        dividendYield: pickNumber(getVal('配当利回り')),
                        dividend_per_share: pickNumber(getVal('1株配当')),
                        yearly_high: pickNumber(getVal('年初来高値')),
                        yearly_low: pickNumber(getVal('年初来安値'))
                    };
                });

                if (yahooDetails.price !== 'N/A') break; // 取得成功

            } catch (err) {
                console.warn(`      [Warn] Yahoo fetch attempt ${attempts} failed:`, err.message);
            }
        }

        // 最終的に失敗した場合、スクリーンショットを撮って保存
        if (yahooDetails.price === 'N/A') {
            console.error(`      [Error] Yahoo Finance 取得に最終失敗しました (${code})。状況を確認するためスクリーンショットを保存します。`);
            const errPath = `public/screenshots/error_yahoo_${code}.png`;
            await page.screenshot({ path: errPath, fullPage: true });
            try {
                const fileContent = fs.readFileSync(errPath);
                await supabase.storage.from('screenshots').upload(`error_yahoo_${code}.png`, fileContent, {
                    contentType: 'image/png',
                    upsert: true
                });
                console.log(`      [Info] エラー画面を Supabase にアップロードしました: error_yahoo_${code}.png`);
            } catch (se) {
                console.warn(`      [Warn] エラー画面のアップロードに失敗しました:`, se.message);
            }
        }

        // --- 2. 楽しい株主優待＆配当 (スキップが指示されたため削除) ---
        /*
        try {
            await page.goto(`https://www.kabuyutai.com/tool/index.php?code=${code}&btn=%E3%81%93%E3%81%AE%E6%9D%A1%E4%BB%B6%E3%81%A7%E6%A4%9C%E7%B4%A2%E3%81%99%E3%82%8B`, { waitUntil: 'load' });
            ...
        } catch (ye) {
            console.warn(`[Warn] Kabuyutai fetch failed for ${code}:`, ye.message);
        }
        */
        const foundDetails = {};

        // --- 3. 株探 (Kabutan) (Retry導入) ---
        let kabutanDetails = { ma5_val: null, ma5_diff: null, ma5_trend: null, ma25_val: null, ma25_diff: null, ma25_trend: null };
        let kAttempts = 0;
        const maxKAttempts = 5;

        while (kAttempts < maxKAttempts) {
            try {
                kAttempts++;
                if (kAttempts > 1) {
                    console.log(`      [Retry] 株探 再試行中 (${kAttempts}/${maxKAttempts})...`);
                    await page.waitForTimeout(3000);
                }

                // domcontentloaded で入り、テーブルセル(td/th)が出るまで待つ
                await page.goto(`https://kabutan.jp/stock/?code=${code}`, { waitUntil: 'domcontentloaded', timeout: 20000 });
                await page.waitForSelector('td, th', { timeout: 10000 }).catch(() => {});
                
                kabutanDetails = await page.evaluate(() => {
                    const results = { ma5_diff: null, ma5_trend: null, ma25_diff: null, ma25_trend: null };
                    const allCells = Array.from(document.querySelectorAll('td, th'));
                    
                    console.log(`[Debug] Analyzing Kabutan MA table... (Total cells: ${allCells.length})`);

                    const getMAData = (keyword) => {
                        const nameCell = allCells.find(el => el.innerText.trim() === keyword);
                        if (!nameCell) {
                            console.log(`[Debug] "${keyword}" label not found.`);
                            return { diff: null, trend: null };
                        }
                        
                        const row = nameCell.parentElement;
                        const index = Array.from(row.cells).indexOf(nameCell);
                        if (index === -1) return { diff: null, trend: null };

                        // 1つ下の行から乖離率（数値）を取得
                        const nextRow = row.nextElementSibling;
                        let diff = null;
                        if (nextRow && nextRow.cells[index]) {
                            const rawText = nextRow.cells[index].innerText.trim();
                            const m = rawText.match(/[+-]?[0-9.]+/);
                            if (m) diff = parseFloat(m[0]);
                            console.log(`[Debug] ${keyword} Value Row: "${rawText}", Parsed: ${diff}`);
                        }

                        // 1つ上の行からトレンド（画像alt）を取得
                        const prevRow = row.previousElementSibling;
                        let trend = null;
                        if (prevRow && prevRow.cells[index]) {
                            const img = prevRow.cells[index].querySelector('img');
                            if (img) {
                                trend = img.alt || null;
                                console.log(`[Debug] ${keyword} Trend Row Alt: "${trend}"`);
                            }
                        }

                        return { diff, trend };
                    };

                    const ma5 = getMAData('5日線');
                    const ma25 = getMAData('25日線');
                    results.ma5_diff = ma5.diff;
                    results.ma5_trend = ma5.trend;
                    results.ma25_diff = ma25.diff;
                    results.ma25_trend = ma25.trend;
                    
                    return results;
                });

                if (kabutanDetails.ma5_diff !== null) break; // 取得成功（最低限ma5_diffがあれば成功とみなす）

            } catch (ke) {
                console.warn(`      [Warn] Kabutan fetch attempt ${kAttempts} failed for ${code}:`, ke.message);
            }
        }

        // --- 4. SBI Chartfolio ---
        let sbiTrend = null;
        try {
            const sbiUrl = `https://chartfolio.sbisec.co.jp/?act_id=trend&p=${code}&rgt=0&hashkey=0174ea04042f2cfa49fdb604c936d037d7f1cf2e&ctype=mainsite&site=site3.sbisec.co.jp`;
            
            // 確実に読み込むため domcontentloaded で入り、少し待機
            await page.goto(sbiUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
            // 選択状態を示すクラスが付与されるまで待機
            await page.waitForSelector('.cftrndcomp-select', { timeout: 15000 }).catch(() => {
                console.log(`[Debug] .cftrndcomp-select not found for ${code} within timeout.`);
            });
            
            // 追加の待機（描画安定のため）
            await page.waitForTimeout(2000);
            
            sbiTrend = await page.evaluate(() => {
                // 1. 選択状態のクラスが付与された要素を基準に探す
                const selectedTrend = document.querySelector('.cftrndcomp-select + .cftrditmlbl');
                if (selectedTrend && selectedTrend.innerText.trim()) return selectedTrend.innerText.trim();
                
                // 2. 選択状態の親要素から探す
                const selectedBlock = document.querySelector('.cftrndcomp-select')?.closest('.cftrditm');
                if (selectedBlock) {
                    const lbl = selectedBlock.querySelector('.cftrditmlbl');
                    if (lbl && lbl.innerText.trim()) return lbl.innerText.trim();
                }

                // 3. 全てのトレンドアイテムから、選択状態のもの（cftrndcomp-select を含むもの）を探す
                const allItems = Array.from(document.querySelectorAll('.cftrditm'));
                for (const item of allItems) {
                    if (item.querySelector('.cftrndcomp-select')) {
                        const lbl = item.querySelector('.cftrditmlbl');
                        if (lbl && lbl.innerText.trim()) return lbl.innerText.trim();
                    }
                }

                return null;
            });
            
            console.log(`[Debug] SBI Trend for ${code}: ${sbiTrend}`);
            
            if (!sbiTrend) {
                console.warn(`      [Warn] SBI trend could not be extracted for ${code}. Taking error screenshot...`);
                const errPath = `public/screenshots/error_sbi_${code}.png`;
                await page.screenshot({ path: errPath, fullPage: true });
                try {
                    const fileContent = fs.readFileSync(errPath);
                    await supabase.storage.from('screenshots').upload(`error_sbi_${code}.png`, fileContent, {
                        contentType: 'image/png',
                        upsert: true
                    });
                } catch (se) {
                    console.warn(`      [Warn] SBI error screenshot upload failed:`, se.message);
                }
            }
        } catch (se) {
            console.warn(`      [Warn] SBI Chartfolio fetch failed for ${code}:`, se.message);
        }

        const stockData = {
            code,
            name: name || undefined,
            ...yahooDetails,
            ...foundDetails,
            ...kabutanDetails,
            sbi_trend: sbiTrend,
            yahooUrl: `https://finance.yahoo.co.jp/quote/${code}.T`,
            chartUrl: `https://finance.yahoo.co.jp/quote/${code}.T/chart`,
            minkabu_url: `https://minkabu.jp/stock/${code}`, // casing fixed to match upsertStock
            status: 'complete'
        };

        // Supabase 更新
        await upsertStock(stockData);
        return stockData;

    } catch (e) {
        console.error(`[Error] Detail fetch failed for ${code}:`, e.message);
        throw e;
    } finally {
        // 重要: browser は閉じない（共有されているため）。context/page のみ閉じる。
        await context.close();
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
                .order('created_at', { ascending: false })
                .limit(1);

            if (configError) {
                console.error('[Error] 設定の取得に失敗しました:', configError.message);
                process.exit(1);
            }

            if (!configRows || configRows.length === 0) {
                console.error('[Error] 現在の設定が見つかりません。ダッシュボードで設定を保存してください。');
                process.exit(1);
            }

            const config = configRows[0];

            // ストレージのクリーンアップ (過去のスクリーンショットを消去)
            try {
                const { data: files } = await supabase.storage.from('screenshots').list();
                if (files && files.length > 0) {
                    const names = files.map(f => f.name);
                    await supabase.storage.from('screenshots').remove(names);
                    console.log(`[Setup] ストレージから ${names.length} 枚の古いスクリーンショットを削除しました`);
                }
            } catch (err) {
                console.warn('[Setup] ストレージのクリーンアップに失敗しました（継続します）:', err.message);
            }
            let list = [];

            if (config.mode === 'file') {
                console.log('[2/4] モード: ファイル読み込み');
                const { data: targetStocks, error: targetError } = await supabase
                    .from('target_stocks')
                    .select('code, name, shares, avg_price');
                
                if (targetError) {
                    console.error('[Error] 銘柄リストの取得に失敗しました:', targetError.message);
                    process.exit(1);
                }

                list = (targetStocks || []).map(s => ({
                    code: s.code,
                    name: s.name,
                    shares: s.shares,
                    avg_price: s.avg_price,
                    status: 'pending'
                }));

                // ダッシュボード側に進捗を表示させるため、一旦 stocks テーブルをクリアして pending 状態で登録
                console.log(`      -> ${list.length} 件の銘柄を初期化登録中...`);
                await supabase.from('stocks').delete().neq('code', '');
                if (list.length > 0) {
                    const initialData = list.map(s => ({
                        code: s.code,
                        name: s.name,
                        shares: s.shares,
                        avg_price: s.avg_price,
                        status: 'pending',
                        updated_at: new Date().toISOString()
                    }));
                    await supabase.from('stocks').upsert(initialData);
                }
            } else {
                console.log('[2/4] モード: 条件検索');
                list = await fetchStockList(config);
            }

            console.log(`[3/4] ${list.length} 件の銘柄を処理対象として認識しました`);
            
            const retryList = [];
            
            // --- Phase 3: 1周目のメイン巡回 ---
            for (let i = 0; i < list.length; i++) {
                const s = list[i];
                console.log(`      (${i + 1}/${list.length}) ${s.name} (${s.code}) を詳細取得中...`);
                try {
                    const result = await fetchStockDetail(s.code, s.name);
                    // ファイルモードの場合は保有数と単価を引き継ぐ
                    if (config.mode === 'file') {
                        result.shares = s.shares;
                        result.avg_price = s.avg_price;
                        await upsertStock(result);
                    }
                    if (result.price === 'N/A') {
                        retryList.push(s);
                    }
                } catch (e) {
                    console.error(`      [Warn] ${s.code} の取得に失敗しました:`, e.message);
                    retryList.push(s);
                }
                
                if (i < list.length - 1) {
                    const waitMinutes = config.scraping?.intervalMinutes || 1;
                    const waitMs = waitMinutes * 60 * 1000;
                    console.log(`      -> 次の銘柄まで ${waitMinutes} 分待機します...`);
                    await new Promise(r => setTimeout(r, waitMs));
                }
            }

            // --- Phase 4: 再試行フェーズ (失敗銘柄のみ, 最大5回まで) ---
            let retryRound = 0;
            const maxRetryRounds = 5;
            while (retryList.length > 0 && retryRound < maxRetryRounds) {
                retryRound++;
                console.log('==================================================');
                console.log(`[Phase 4] 再試行ラウンド ${retryRound}/${maxRetryRounds}: ${retryList.length} 件を再試行します`);
                console.log('5分待機してサーバー側の制限解除を待ちます...');
                console.log('==================================================');
                await new Promise(resolve => setTimeout(resolve, 300000)); // 5分待機

                const currentRoundTargets = [...retryList];
                retryList.length = 0; // 次のラウンド用に一旦クリア

                for (let i = 0; i < currentRoundTargets.length; i++) {
                    const s = currentRoundTargets[i];
                    console.log(`      [Retry R${retryRound}] (${i + 1}/${currentRoundTargets.length}) ${s.name} (${s.code}) を再取得中...`);
                    try {
                        const result = await fetchStockDetail(s.code, s.name);
                        if (result.price === 'N/A') {
                            retryList.push(s);
                        }
                    } catch (e) {
                        console.error(`      [Retry Error R${retryRound}] ${s.code} の再取得に失敗しました:`, e.message);
                        retryList.push(s);
                    }
                    if (i < currentRoundTargets.length - 1) {
                        console.log(`      -> 次の銘柄まで 1 分待機します...`);
                        await new Promise(resolve => setTimeout(resolve, 60000));
                    }
                }
            }
            
            console.log('==================================================');
            console.log('[End] すべての処理が完了しました');
            console.log(`[Time] ${new Date().toLocaleString('ja-JP')}`);
            console.log('==================================================');

        } catch (globalError) {
            console.error('==================================================');
            console.error('[Critical Error] 実行中に致命的なエラーが発生しました');
            console.error(globalError);
            console.error('==================================================');
            process.exit(1);
        }
    })();
}
