import { chromium } from 'playwright';
async function testKabutan() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://kabutan.jp/stock/?code=1377', { waitUntil: 'domcontentloaded' });
    
    // Evaluate and get the percent values
    const maData = await page.evaluate(() => {
        const els = Array.from(document.querySelectorAll('table'));
        let found = { ma5: 'N/A', ma25: 'N/A' };
        for (const t of els) {
            if (t.innerText.includes('5日線') && t.innerText.includes('25日線')) {
                const lines = t.innerText.split('\n').map(l => l.trim()).filter(l => l.length > 0);
                const labelLine = lines.findIndex(l => l.includes('5日線'));
                if (labelLine >= 0 && labelLine + 1 < lines.length) {
                    const labels = lines[labelLine].split(/\s+/);
                    const values = lines[labelLine + 1].split(/\s+/);
                    const idx5 = labels.findIndex(l => l.includes('5日線'));
                    const idx25 = labels.findIndex(l => l.includes('25日線'));
                    if (idx5 >= 0 && values[idx5]) found.ma5 = values[idx5];
                    if (idx25 >= 0 && values[idx25]) found.ma25 = values[idx25];
                }
                break;
            }
        }
        return found;
    });
    console.log(maData);
    await browser.close();
}
testKabutan().catch(console.error);
