import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    // Search for 1377 (Sakata no Tane)
    await page.goto('https://www.kabuyutai.com/tool/index.php?code=1377&btn=%E3%81%93%E3%81%AE%E6%9D%A1%E4%BB%B6%E3%81%A7%E6%A4%9C%E7%B4%A2%E3%81%99%E3%82%8B', { waitUntil: 'load' });
    
    const labelInfo = await page.evaluate(() => {
        const item = document.querySelector('.table_tr');
        if (!item) return "No item";
        const ps = Array.from(item.querySelectorAll('p')).map(p => p.innerText.trim());
        const spans = Array.from(item.querySelectorAll('span')).map(s => ({
            class: s.className,
            text: s.innerText.trim(),
            html: s.outerHTML
        }));
        return { ps, spans };
    });
    console.log(JSON.stringify(labelInfo, null, 2));
    await browser.close();
}
test().catch(console.error);
