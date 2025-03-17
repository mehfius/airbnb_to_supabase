import puppeteer from 'puppeteer';
import { SELECTOR } from '../config/constants';

export async function scrape_prices(urls: string[]) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  const results = [];

  for (const url of urls) {
    await page.goto(url);
    const price = await page.$eval(SELECTOR.PRICE, el => el.textContent?.trim() || 'N/A');
    results.push({ url, price });
  }

  await browser.close();
  return results;
} 