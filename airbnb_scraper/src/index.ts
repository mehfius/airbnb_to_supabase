import { scrape_prices } from './services/scraper_service';
import { save_to_json } from './services/file_service';

const property_urls = [
  'https://www.airbnb.com.br/rooms/45592704?check_in=2025-05-21&guests=1&adults=1&check_out=2025-05-24',
];

async function main() {
  const prices = await scrape_prices(property_urls);
  save_to_json(prices);
}

main(); 