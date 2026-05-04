import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });
    
    // Check Month 4
    await page.evaluate(() => {
        const input = document.querySelector('input[name="fm[]"][value="4"]');
        if (input) {
            input.checked = true;
            input.dispatchEvent(new Event('change', { bubbles: true }));
        }
    });

    await page.waitForTimeout(500);
    
    // Check if visual state changed
    const month4Info = await page.evaluate(() => {
        const input = document.querySelector('input[name="fm[]"][value="4"]');
        const label = document.querySelector(`label[for="${input?.id}"]`) || input?.nextElementSibling;
        return {
            inputId: input?.id,
            inputVisible: input?.offsetWidth > 0,
            labelTag: label?.tagName,
            labelClass: label?.className,
            labelHtml: label?.outerHTML
        };
    });
    console.log("MONTH 4 INFO:", month4Info);

    // Perform search to see results
    await page.goto('https://www.kabuyutai.com/tool/index.php?fm[]=4&btn=%E3%81%93%E3%81%AE%E6%9D%A1%E4%BB%B6%E3%81%A7%E6%A4%9C%E7%B4%A2%E3%81%99%E3%82%8B', { waitUntil: 'load' });
    await page.waitForSelector('.table_tr', { timeout: 10000 });
    
    const resultHtml = await page.evaluate(() => {
        const item = document.querySelector('.table_tr');
        if (!item) return "No item found";
        
        const inner = item.innerHTML;
        const labels = Array.from(item.querySelectorAll('*')).map(el => ({
            tag: el.tagName,
            class: el.className,
            text: el.innerText
        }));
        return { inner, labels: labels.slice(0, 50) };
    });
    console.log("RESULT HTML DUMP:", JSON.stringify(resultHtml, null, 2));

    await browser.close();
}
test().catch(console.error);
