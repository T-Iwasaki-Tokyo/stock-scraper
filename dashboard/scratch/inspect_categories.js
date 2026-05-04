import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });
    
    const catInfo = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('input[name="cat_group"]')).map(el => {
            const parent = el.parentElement;
            return {
                value: el.value,
                parentTag: parent.tagName,
                parentText: parent.innerText.trim(),
                html: el.outerHTML
            };
        });
    });
    console.log(JSON.stringify(catInfo, null, 2));
    await browser.close();
}
test().catch(console.error);
