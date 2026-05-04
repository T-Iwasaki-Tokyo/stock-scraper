import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });
    
    const formHtml = await page.evaluate(() => {
        const form = document.querySelector('form');
        return form ? form.innerHTML : "Form not found";
    });
    // Save to file for full viewing
    import('fs').then(fs => fs.writeFileSync('scratch/form_html.txt', formHtml));
    
    // Also taking a screenshot of the form area
    await page.screenshot({ path: 'scratch/actual_form.png', fullPage: false });
    
    await browser.close();
}
test().catch(console.error);
