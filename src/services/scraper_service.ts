import puppeteer from 'puppeteer';
import { SELECTOR } from '../config/constants';
import { PropertyData } from '../types/types';

export async function scrape_prices(urls: string[], concurrency = 7): Promise<PropertyData[]> {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: null
  });

  const results: PropertyData[] = [];

  // Special case for single concurrency
  if (concurrency === 1) {
    const page = await browser.newPage();
    
    for (const url of urls) {
      const room_id = new URL(url).pathname.split('/').pop() || 'unknown';
      const result = {
        url,
        price: 'N/A',
        fee: 'N/A',
        label: 'Unknown Property',
        date_range: 'Unknown',
        host_name: 'Unknown Host',
        special_offer: null as string | null,
        checked_url: url
      };

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
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
            page.waitForSelector('div#bookItTripDetailsError', { timeout: 2000 })
          ]);
          
          const price_element = await page.$(SELECTOR.PRICE);
          const error_element = await page.$('div#bookItTripDetailsError');
          
          if (error_element) {
            const date_error = await page.$eval('div#bookItTripDetailsError', (el) => el.textContent?.trim() || 'Dates not available')
              .catch(() => 'Dates not available');
            error_message += date_error;
            result.price = 'Dates not available';
          } else if (price_element) {
            result.price = await page.$eval(SELECTOR.PRICE, (el) => el.textContent?.trim() || 'N/A')
              .catch(() => 'N/A');
            result.fee = await page.$eval(SELECTOR.FEE, (el) => el.textContent?.trim() || 'N/A')
              .catch(() => 'N/A');
            
            // Check for special offer
            try {
              result.special_offer = await page.$eval(SELECTOR.SPECIAL_OFFER, (el) => el.textContent?.trim() || null)
                .catch(() => null);
            } catch {
              result.special_offer = null;
            }
            
            if (result.price !== 'N/A') {
              console.log(`✅ Room ${room_id} - ${check_in}: Price: ${result.price}, Fee: ${result.fee}, Special Offer: ${result.special_offer || 'None'}`);
              results.push(result);
            } else {
              error_message += 'Price not found. ';
            }
          } else {
            error_message += 'No price/error found. ';
            result.price = 'Error';
          }
        } catch (error) {
          error_message += 'Timeout waiting for price. ';
          result.price = 'Timeout';
        }
        
        // Show consolidated error message if any errors occurred
        if (error_message) {
          console.warn(`⚠️ Room ${room_id} - ${check_in}: ${error_message.trim()}`);
        }
      } catch (error) {
        console.warn(`⚠️ Room ${room_id} - ${new URL(url).searchParams.get('check_in') || 'Unknown Date'}: Page load failed`);
        result.price = 'Error loading page';
      }
      
      results.push(result);
    }
    
    await page.close();
    await browser.close();
    return Array.isArray(results) ? results : [results];
  }

  // Existing batch processing for concurrency > 1
  for (let i = 0; i < urls.length; i += concurrency) {
    const batch = urls.slice(i, i + concurrency);
    const batchPromises = batch.map(async (url) => {
      const context = await browser.createBrowserContext();
      const page = await context.newPage();

      const room_id = new URL(url).pathname.split('/').pop() || 'unknown';
      const result = {
        url,
        price: 'N/A',
        fee: 'N/A',
        label: 'Unknown Property',
        date_range: 'Unknown',
        host_name: 'Unknown Host',
        special_offer: null as string | null,
        checked_url: url
      };

      try {
        await page.goto(url, { waitUntil: 'networkidle2', timeout: 30000 });
        
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
            page.waitForSelector('div#bookItTripDetailsError', { timeout: 2000 })
          ]);
          
          const price_element = await page.$(SELECTOR.PRICE);
          const error_element = await page.$('div#bookItTripDetailsError');
          
          if (error_element) {
            const date_error = await page.$eval('div#bookItTripDetailsError', (el) => el.textContent?.trim() || 'Dates not available')
              .catch(() => 'Dates not available');
            error_message += date_error;
            result.price = 'Dates not available';
          } else if (price_element) {
            result.price = await page.$eval(SELECTOR.PRICE, (el) => el.textContent?.trim() || 'N/A')
              .catch(() => 'N/A');
            result.fee = await page.$eval(SELECTOR.FEE, (el) => el.textContent?.trim() || 'N/A')
              .catch(() => 'N/A');
            
            // Check for special offer
            try {
              result.special_offer = await page.$eval(SELECTOR.SPECIAL_OFFER, (el) => el.textContent?.trim() || null)
                .catch(() => null);
            } catch {
              result.special_offer = null;
            }
            
            if (result.price !== 'N/A') {
              console.log(`✅ Room ${room_id} - ${check_in}: Price: ${result.price}, Fee: ${result.fee}, Special Offer: ${result.special_offer || 'None'}`);
              results.push(result);
            } else {
              error_message += 'Price not found. ';
            }
          } else {
            error_message += 'No price/error found. ';
            result.price = 'Error';
          }
        } catch (error) {
          error_message += 'Timeout waiting for price. ';
          result.price = 'Timeout';
        }
        
        // Show consolidated error message if any errors occurred
        if (error_message) {
          console.warn(`⚠️ Room ${room_id} - ${check_in}: ${error_message.trim()}`);
        }
      } catch (error) {
        console.warn(`⚠️ Room ${room_id} - ${new URL(url).searchParams.get('check_in') || 'Unknown Date'}: Page load failed`);
        result.price = 'Error loading page';
      } finally {
        await page.close();
        await context.close();
      }

      return result;
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }

  await browser.close();
  return Array.isArray(results) ? results : [results];
} 