import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    
    // Check Kabutan for 3134
    console.log("Checking Kabutan for 3134...");
    await page.goto('https://kabutan.jp/stock/?code=3134', { waitUntil: 'load' });
    const kabutanInfo = await page.evaluate(() => {
        const results = {};
        const cells = Array.from(document.querySelectorAll('td, th'));
        const ma5 = cells.find(el => el.innerText.includes('5日線'));
        const ma25 = cells.find(el => el.innerText.includes('25日線'));
        const price = document.querySelector('.stock_price')?.innerText;
        return {
            ma5: ma5 ? { text: ma5.innerText, next: ma5.nextElementSibling?.innerText, row: ma5.parentElement?.innerText } : "Not found",
            ma25: ma25 ? { text: ma25.innerText, next: ma25.nextElementSibling?.innerText, row: ma25.parentElement?.innerText } : "Not found",
            price
        };
    });
    console.log("KABUTAN INFO:", JSON.stringify(kabutanInfo, null, 2));

    // Check Kabuyutai Detail for 3134
    console.log("Checking Kabuyutai for 3134...");
    await page.goto('https://www.kabuyutai.com/tool/index.php?code=3134&btn=%E3%81%93%E3%81%AE%E6%9D%A1%E4%BB%B6%E3%81%A7%E6%A4%9C%E7%B4%A2%E3%81%99%E3%82%8B', { waitUntil: 'load' });
    const yutaiInfo = await page.evaluate(() => {
        const item = document.querySelector('.table_tr');
        if (!item) return "No item found";
        return {
            html: item.outerHTML,
            rima: item.querySelector('.rima_num')?.innerText,
            ty: item.querySelector('[data-js="ty"]')?.innerText
        };
    });
    console.log("YUTAI INFO:", JSON.stringify(yutaiInfo, null, 2));

    await browser.close();
}
test().catch(console.error);
