import { chromium } from 'playwright';
async function testClick() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });
    
    console.log("Evaluating click...");
    await Promise.all([
        page.waitForNavigation({ waitUntil: 'load', timeout: 60000 }).catch(e => console.log('Navigation timeout:', e.message)),
        page.evaluate(() => {
            const links = Array.from(document.querySelectorAll('a'));
            const btn = links.find(a => a.innerText.includes('この条件で検索する') && a.offsetWidth > 0 && a.offsetHeight > 0);
            if (btn) {
                console.log('Found visible button, clicking...');
                btn.click();
            } else {
                console.log('No visible button found');
            }
        })
    ]);
    
    console.log('Current URL after click:', page.url());

    const results = await page.$$eval('.table_tr', els => els.length).catch(() => 0);
    console.log('Found table rows:', results);

    await browser.close();
}
testClick().catch(console.error);
