import { scrape_prices } from './services/scraper_service';
import { save_to_json } from './services/file_service';
import { addDays, format, parseISO, isValid } from 'date-fns';

function generate_urls(room_ids: string[], start_date: Date, days: number): string[] {
  const urls = [];
  for (const room_id of room_ids) {
    const base_url = `https://www.airbnb.com.br/rooms/${room_id}`;
    for (let i = 0; i < days; i++) {
      const check_in = format(addDays(start_date, i), 'yyyy-MM-dd');
      const check_out = format(addDays(start_date, i + 3), 'yyyy-MM-dd');
      const url = `${base_url}?check_in=${check_in}&guests=1&adults=1&check_out=${check_out}&source_impression_id=p3_1742232675_P3HX3gc2K_DQTIUX`;
      urls.push(url);
    }
  }
  return urls;
}

async function main() {
  const start_time = Date.now();
  
  const room_ids = [
    '45592704',
    '684243789461931776',
    '1299362903221261486',
    '35003338'
  ];
  
  // Get start date from command line or use tomorrow
  const start_date_arg = process.argv[2];
  const start_date = start_date_arg ? parseISO(start_date_arg) : addDays(new Date(), 1);
  
  if (start_date_arg && !isValid(parseISO(start_date_arg))) {
    console.error('Invalid date format. Please use YYYY-MM-DD');
    process.exit(1);
  }

  // Get concurrency from command line or use default (7)
  const concurrency = process.argv[3] ? parseInt(process.argv[3]) : 7;
  
  // Get number of days from command line or use default (7)
  const days = process.argv[4] ? parseInt(process.argv[4]) : 7;
  
  const property_urls = generate_urls(room_ids, start_date, days);
  const prices = await scrape_prices(property_urls, concurrency);
  
  const end_time = Date.now();
  const total_seconds = ((end_time - start_time) / 1000).toFixed(2);
  
  console.log(`\n⏱️ Total execution time: ${total_seconds} seconds`);
  save_to_json(prices);
}

main(); 