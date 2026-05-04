import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.kabuyutai.com/tool/index.php?fm[]=3&btn=%E3%81%93%E3%81%AE%E6%9D%A1%E4%BB%B6%E3%81%A7%E6%A4%9C%E7%B4%A2%E3%81%99%E3%82%8B', { waitUntil: 'load' });
    
    await page.waitForSelector('.table_tr', { timeout: 10000 });
    const html = await page.evaluate(() => {
        const tr = document.querySelector('.table_tr');
        return tr ? tr.innerHTML : 'Not found';
    });
    console.log("TABLE_TR HTML:\n", html);
    await browser.close();
}
test().catch(console.error);
