import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    console.log("Fetching 3134.T...");
    await page.goto('https://finance.yahoo.co.jp/quote/3134.T', { waitUntil: 'load' });
    const result = await page.evaluate(() => {
        const dts = Array.from(document.querySelectorAll('dt')).map(dt => dt.innerText);
        const priceEl = document.querySelector('[class*="PriceBoard__price"]');
        const priceText = priceEl ? priceEl.innerText : 'NOT FOUND';
        
        // Find absolute price elsewhere
        const titlePrice = document.querySelector('._3M-vTqfI, ._2S_1t3_Z')?.innerText;

        return {
            dts: dts.slice(0, 50),
            priceText,
            titlePrice
        };
    });
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
}
test().catch(console.error);
