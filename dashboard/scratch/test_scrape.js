import { chromium } from 'playwright';

async function testScrape() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Test URL - Shibaura Mechatronics (6222) as an example
    const searchUrl = 'https://www.kabuyutai.com/tool/shiborikomi/?fm=4'; 
    console.log(`Visiting: ${searchUrl}`);
    
    await page.goto(searchUrl, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('.table_tr', { timeout: 10000 });

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
                return span ? span.innerText.trim() : 'N/A';
            };

            return {
                name: nameLink ? nameLink.innerText.trim() : '不明',
                code: codeSpan ? codeSpan.innerText.trim() : null,
                totalYield: tyEl ? tyEl.innerText.trim() : 'N/A',
                dividendYield: pickYield('【予想配当利回り】'),
                yutaiYield: pickYield('【優待利回り】')
            };
        }).filter(s => s.code);
    });

    console.log('Scraped Stocks (Top 3):');
    console.log(JSON.stringify(stocks.slice(0, 3), null, 2));

    await browser.close();
}

testScrape().catch(console.error);
