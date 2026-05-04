import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });
    
    // Fill search box if any, or just month 3 which has many results
    await page.click('label:has-text("3月")');
    await page.click('a:has-text("この条件で検索する")');
    
    await page.waitForNavigation({ waitUntil: 'load', timeout: 30000 });
    await page.waitForSelector('.table_tr', { timeout: 10000 });
    
    const firstResult = await page.evaluate(() => {
        const item = document.querySelector('.table_tr');
        if (!item) return "No item";
        const res = {};
        const labels = ["【優待利回り】", "【予想配当利回り】", "【総合利回り】"];
        labels.forEach(l => {
             const found = Array.from(item.querySelectorAll('*')).find(el => el.innerText.includes(l));
             if (found) {
                res[l] = { text: found.innerText, html: found.parentElement.outerHTML };
             } else {
                res[l] = "Not found";
             }
        });
        // Also look for rima_num
        const rima = item.querySelector('.rima_num');
        res['rima_num'] = rima ? rima.outerHTML : "Not found";
        return res;
    });
    console.log(JSON.stringify(firstResult, null, 2));
    await browser.close();
}
test().catch(console.error);
