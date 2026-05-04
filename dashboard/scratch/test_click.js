import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });
    
    // Attempt clicking 4月 label
    console.log("Attempting to click label with text '4月'...");
    try {
        await page.click('label:has-text("4月")', { timeout: 5000 });
        console.log("Clicked label.");
    } catch (e) {
        console.log("Label click failed, trying alternative text search...");
        const label = await page.evaluateHandle(() => {
            return Array.from(document.querySelectorAll('label, div, span, li')).find(el => el.innerText.trim() === '4月');
        });
        if (label) {
            await label.asElement().click();
            console.log("Found and clicked alternative element.");
        } else {
            console.log("No element with text '4月' found.");
        }
    }
    
    await page.waitForTimeout(500);
    await page.screenshot({ path: 'test_click.png' });
    
    // Check if input is checked
    const checked = await page.evaluate(() => {
        const input = Array.from(document.querySelectorAll('input[name="fm[]"]')).find(el => el.parentElement.innerText.includes('4月') || el.nextElementSibling?.innerText.includes('4月'));
        return input ? input.checked : "Input not found";
    });
    console.log("Input checked status:", checked);
    
    await browser.close();
}
test().catch(console.error);
