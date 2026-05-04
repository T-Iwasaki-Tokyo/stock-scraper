import { chromium } from 'playwright';
import fs from 'fs';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
        userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    });
    const page = await context.newPage();

    const code = '2003';
    const sbiUrl = `https://chartfolio.sbisec.co.jp/?act_id=trend&p=${code}&rgt=0&hashkey=0174ea04042f2cfa49fdb604c936d037d7f1cf2e&ctype=mainsite&site=site3.sbisec.co.jp`;
    
    console.log(`Navigating to ${sbiUrl}...`);
    try {
        await page.goto(sbiUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        console.log('Page loaded. Waiting for selector...');
        
        // Wait for some content to load
        await page.waitForTimeout(5000);
        
        const sbiTrend = await page.evaluate(() => {
            // Check for the selected trend label
            const selectedTrend = document.querySelector('.cftrndcomp-select + .cftrditmlbl');
            if (selectedTrend) return selectedTrend.innerText.trim();
            
            // Try to find the block that is highlighted
            const selectedBlock = document.querySelector('.cftrndcomp-select')?.closest('.cftrditm');
            if (selectedBlock) {
                const lbl = selectedBlock.querySelector('.cftrditmlbl');
                return lbl ? lbl.innerText.trim() : null;
            }
            
            return null;
        });
        
        console.log(`SBI Trend for ${code}: "${sbiTrend}"`);
        
        if (!sbiTrend) {
            console.log('Could not find trend. Taking screenshot and saving HTML...');
            await page.screenshot({ path: 'scratch/sbi_error.png', fullPage: true });
            const html = await page.content();
            fs.writeFileSync('scratch/sbi_error.html', html);
            
            // List all trends found on page
            const allTrends = await page.evaluate(() => {
                return Array.from(document.querySelectorAll('.cftrditm')).map(el => {
                    const name = el.querySelector('.cftrdcpname')?.innerText.trim();
                    const trend = el.querySelector('.cftrditmlbl')?.innerText.trim();
                    const isSelected = el.querySelector('.cftrndcomp-select') !== null;
                    return { name, trend, isSelected };
                });
            });
            console.log('Trends found on page:', allTrends.filter(t => t.isSelected || t.name));
        }
    } catch (e) {
        console.error('Error:', e.message);
    } finally {
        await browser.close();
    }
})();
