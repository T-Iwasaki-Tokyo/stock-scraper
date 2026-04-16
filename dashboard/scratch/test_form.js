import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });
    const forms = await page.$$eval('form', forms => forms.map(f => ({
        action: f.action,
        id: f.id,
        name: f.name,
        buttons: Array.from(f.querySelectorAll('input[type="image"], input[type="submit"]')).map(btn => btn.name || btn.value)
    })));
    console.log(forms);
    await browser.close();
}
test().catch(console.error);
