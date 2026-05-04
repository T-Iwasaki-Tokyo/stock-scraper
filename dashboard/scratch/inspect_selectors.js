import { chromium } from 'playwright';
async function test() {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();
    await page.goto('https://www.kabuyutai.com/tool/', { waitUntil: 'load' });
    
    const info = await page.evaluate(() => {
        const getInputs = (name) => Array.from(document.querySelectorAll(`input[name*="${name}"]`)).map(i => ({ name: i.name, value: i.value, type: i.type }));
        return {
            fm: getInputs('fm'),
            cat: getInputs('cat_group'),
            st: Array.from(document.querySelectorAll('select[name="st"] option')).map(o => o.value),
            btn: Array.from(document.querySelectorAll('a, input, button')).filter(el => el.innerText?.includes('この条件で検索する') || el.value?.includes('この条件で検索する')).map(el => ({ tag: el.tagName, text: el.innerText, value: el.value }))
        };
    });
    console.log(JSON.stringify(info, null, 2));
    await browser.close();
}
test().catch(console.error);
