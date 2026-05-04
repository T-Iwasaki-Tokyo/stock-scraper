import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });
    
    // Dump HTML and computed styles of the area around Month 4
    const html = await page.evaluate(() => {
        const input = document.querySelector('input[name="fm[]"][value="4"]');
        if (!input) return "Input not found";
        
        const parent = input.parentElement;
        const info = (el) => ({
            tag: el.tagName,
            type: el.type,
            value: el.value,
            class: el.className,
            html: el.outerHTML,
            display: getComputedStyle(el).display,
            visibility: getComputedStyle(el).visibility,
            opacity: getComputedStyle(el).opacity
        });

        return {
            input: info(input),
            parent: info(parent)
        };
    });
    console.log(JSON.stringify(html, null, 2));

    // Also look for "総合利回り" select
    const selectInfo = await page.evaluate(() => {
        const sel = document.querySelector('select[name="tyf"]');
        return sel ? { html: sel.outerHTML, value: sel.value, options: Array.from(sel.options).map(o => ({text: o.text, value: o.value})) } : "Select not found";
    });
    console.log("SELECT tyf:", selectInfo);

    await browser.close();
}
test().catch(console.error);
