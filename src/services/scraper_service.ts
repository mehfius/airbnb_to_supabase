import puppeteer from 'puppeteer';
import { SELECTOR } from '../config/constants';
import { PropertyData } from '../types/types';

export async function scrape_prices(urls: string[]): Promise<PropertyData[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  const results: PropertyData[] = [];
  const page = await browser.newPage();
  
  for (const url of urls) {
    const room_id = new URL(url).pathname.split('/').pop() || 'unknown';
    const result = {
      url,
      price: null as number | null,
      label: 'Unknown Property',
      date_range: 'Unknown',
      host_name: 'Unknown Host',
      room_id: new URL(url).pathname.split('/').pop() || 'unknown',
      total: null as number | null,
      error: undefined as string | undefined,
      html_sidebar: '' as string
    };

    try {
      await page.goto(url, { 
        waitUntil: 'networkidle2', 
        timeout: 30000,
        referer: 'https://www.airbnb.com.br/'
      });
      
      const check_in = new URL(url).searchParams.get('check_in') || 'Unknown Date';
      let error_message = '';
      
      // Extract property details with error handling
      result.label = await page.$eval(SELECTOR.LABEL, (el) => el.textContent?.trim() || 'Unknown Property')
        .catch(() => {
          error_message += 'Label not found. ';
          return 'Unknown Property';
        });
      
      result.host_name = await page.$eval(SELECTOR.HOST_NAME, (el) => {
        const text = el.textContent?.trim() || '';
        return text.replace('Anfitriã(o):', '').trim();
      }).catch(() => {
        error_message += 'Host not found. ';
        return 'Unknown Host';
      });
      
      const url_params = new URL(url).searchParams;
      result.date_range = `${url_params.get('check_in')} to ${url_params.get('check_out')}`;
      
      try {
        await Promise.race([
          page.waitForSelector(SELECTOR.PRICE, { timeout: 2000 }),
          page.waitForSelector(SELECTOR.UNAVAILABLE_DATES, { timeout: 2000 })
        ]);
        
        const price_element = await page.$(SELECTOR.PRICE);
        const error_element = await page.$(SELECTOR.UNAVAILABLE_DATES);
        
        if (error_element) {
          const date_error = await page.$eval(SELECTOR.UNAVAILABLE_DATES, (el) => el.textContent?.trim() || 'Dates not available')
            .catch(() => 'Dates not available');
          error_message += date_error;
          result.price = null;
        } else if (price_element) {
          result.price = await page.$eval(SELECTOR.PRICE, (el) => el.textContent?.trim() || null)
            .then(clean_and_convert)
            .catch(() => null);
          
          if (result.price !== null) {
            console.log(`\x1b]8;;${url}\x1b\\[Link]\x1b]8;;\x1b\\ ✅ ${check_in}: Price: ${result.price} - Room ${room_id}`);
          } else {
            error_message += 'Price not found. ';
          }

          // Update total extraction
          result.total = await page.$eval(SELECTOR.TOTAL, (el) => {
            const total_text = el.textContent?.trim() || '';
            return parseFloat(total_text.replace('R$', '').replace('.', '').replace(',', '.'));
          }).catch(() => null as number | null);
        } else {
          error_message += 'No price/error found. ';
          result.price = null;
        }
      } catch (error) {
        error_message += 'Timeout waiting for price. ';
        result.price = null;
      }
      
      // Show consolidated error message if any errors occurred
      if (error_message) {
        console.warn(`\x1b]8;;${url}\x1b\\[Link]\x1b]8;;\x1b\\ ⚠️  ${check_in}: ${error_message.trim()} - Room ${room_id}`);
        const book_it_sidebar = await page.$(SELECTOR.BOOK_IT_SIDEBAR);
        if (book_it_sidebar) {
          const sidebar_content = await page.$eval(SELECTOR.BOOK_IT_SIDEBAR, (el) => el.innerHTML);
          result.html_sidebar = sidebar_content;
          const has_dollar = sidebar_content.includes('R$') ? '✅' : '❌';
          console.log(`Room ${room_id}: Found $ in BOOK_IT_SIDEBAR: ${has_dollar}`);
        }
      }
    } catch (error) {
      console.warn(`\x1b]8;;${url}\x1b\\[Link]\x1b]8;;\x1b\\ ⚠️  ${new Date().toISOString()}: Navigation failed - Room ${room_id}`);
      result.price = null;
      if (error instanceof Error) {
        result.error = error.message;
      } else {
        result.error = 'Unknown error occurred';
      }
      
      const book_it_sidebar = await page.$(SELECTOR.BOOK_IT_SIDEBAR);
      if (book_it_sidebar) {
        const sidebar_content = await page.$eval(SELECTOR.BOOK_IT_SIDEBAR, (el) => el.innerHTML);
        result.html_sidebar = sidebar_content;
        const has_dollar = sidebar_content.includes('$') ? '✅' : '❌';
        console.log(`Room ${room_id}: Found $ in BOOK_IT_SIDEBAR: ${has_dollar}`);
      }
    }
    
    results.push(result);
  }
  
  await page.close();
  await browser.close();
  return results;
}

// Helper function to clean and convert to number
const clean_and_convert = (value: string | null): number | null => {
  if (!value) return null;
  const cleaned = value.replace('R$', '').replace(/\./g, '').replace(',', '.');
  return parseFloat(cleaned);
}; 