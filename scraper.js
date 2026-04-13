import { chromium } from 'playwright';

export async function getBrowser() {
    return await chromium.launch({ 
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox'] // クラウド環境向け設定例
    });
}

// Phase 1: 銘柄リスト & 総合利回り取得
export async function fetchStockList(config) {
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
    
    let pageNum = 1;
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
            pageNum++;
            await new Promise(r => setTimeout(r, 2000));
        } else {
            break;
        }
    }

    await browser.close();
    return Array.from(new Map(allStocks.map(s => [s.code, s])).values()).slice(0, config.scraping.maxStocks);
}

// Phase 2: 銘柄詳細（株価・配当・PBR）取得
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
                dividendYield: pickNumber(getVal('配当利回り')),
                pbr: pickNumber(getVal('PBR'))
            };
        });

        await browser.close();
        return {
            ...details,
            chartUrl: `https://finance.yahoo.co.jp/quote/${code}.T/chart`,
            yahooUrl: `https://finance.yahoo.co.jp/quote/${code}.T`,
            timestamp: new Date().toLocaleString('ja-JP'),
            status: 'complete'
        };
    } catch (e) {
        await browser.close();
        throw e;
    }
}
