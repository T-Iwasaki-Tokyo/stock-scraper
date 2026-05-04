import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    console.log("Checking Yahoo for 3134...");
    await page.goto('https://finance.yahoo.co.jp/quote/3134.T', { waitUntil: 'load' });
    const yahooInfo = await page.evaluate(() => {
        const price = document.querySelector('._3M-vTqfI, ._2S_1t3_Z, ._3rXWJK9P, ._1mD3hY0h')?.innerText;
        const pbr = Array.from(document.querySelectorAll('dt')).find(el => el.innerText.includes('PBR'))?.nextElementSibling?.innerText;
        return { price, pbr, allHtml: document.body.innerText.slice(0, 1000) };
    });
    console.log(JSON.stringify(yahooInfo, null, 2));
    await browser.close();
}
test().catch(console.error);
