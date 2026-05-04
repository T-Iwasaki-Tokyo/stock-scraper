import { fetchStockDetail } from '../lib/scraper.js';
import dotenv from 'dotenv';
dotenv.config();
dotenv.config({ path: '.env.local' });

(async () => {
    const code = '2003';
    const name = '日東富士製粉';
    console.log(`Starting test for ${name} (${code})...`);
    
    try {
        const result = await fetchStockDetail(code, name);
        console.log('Scrape result:', result);
        console.log('SBI Trend in result:', result.sbi_trend);
    } catch (e) {
        console.error('Test failed:', e.message);
    }
    
    process.exit(0);
})();
