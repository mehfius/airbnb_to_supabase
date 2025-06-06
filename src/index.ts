import { scrape_prices } from './services/scraper_service';
import { addDays, format } from 'date-fns';
import { createClient } from '@supabase/supabase-js';

// Supabase Service
const supabase_service = {
  client: createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE!
  ),

  async get_room_ids(): Promise<string[]> {
    try {
      const { data, error } = await this.client
        .from('rooms')
        .select('room_id');
      
      if (error) throw error;
      if (!data) return [];

      return data
        .filter(room => room.room_id !== null)
        .map(room => room.room_id!);
    } catch (error) {
      console.error('Supabase error:', error);
      throw error;
    }
  },

  async upsert_prices(prices: { 
    price: number | null; 
    room_id: string; 
    total: number | null; 
    date_range: string 
  }[]): Promise<void> {
    try {
      const { error } = await this.client
        .from('prices')
        .upsert(prices, {
          onConflict: 'date_range,room_id',
          ignoreDuplicates: false
        });
      
      if (error) throw error;
    } catch (error) {
      console.error('Error upserting prices:', error);
      throw error;
    }
  },

  async log_execution(log_data: {
    room_ids: string[],
    execution_time: string,
    error_messages: string[] | null,
    failed_room_ids: string[] | null,
    failed_count: number,
    successful_count: number,
    html_sidebar: string[] | null
  }): Promise<void> {
    try {
      const { error } = await this.client
        .from('logs')
        .insert(log_data);
      
      if (error) throw error;
    } catch (logError) {
      console.error('Failed to log execution:', logError);
    }
  }
};

function generate_urls(room_ids: string[], start_date: Date, days: number): string[] {
  const urls = [];
  for (const room_id of room_ids) {
    const base_url = `https://www.airbnb.com.br/rooms/${room_id}`;
    for (let i = 0; i < days; i++) {
      const check_in = format(addDays(start_date, i), 'yyyy-MM-dd');
      const check_out = format(addDays(start_date, i + 3), 'yyyy-MM-dd');
      const url = `${base_url}?check_in=${check_in}&guests=1&adults=1&check_out=${check_out}`;
      urls.push(url);
    }
  }
  return urls;
}

async function main() {
  const start_time = Date.now();
  let room_ids: string[] = [];
  const error_messages: string[] = [];
  const failed_room_ids: string[] = [];
  const html_sidebar: string[] = [];
  let successful_count = 0;

  try {
    const start_date = new Date();
    const days = 7;

    console.log('Fetching room ids from Supabase...');
    room_ids = await supabase_service.get_room_ids();
    
    if (!room_ids || room_ids.length === 0) {
      console.error('No room ids found in database');
      error_messages.push('No room ids found in database');
      return;
    }

    console.log('Generating URLs...');
    const property_urls = generate_urls(room_ids, start_date, days);

    console.log('Scraping prices...');
    const prices = await scrape_prices(property_urls);

    // Track failed room_ids and error messages
    prices.forEach(p => {
      if (p.error || p.price === null) {
        failed_room_ids.push(p.room_id);
        const error_msg = p.error || 'Price not found';
        error_messages.push(`Room ${p.room_id}: ${error_msg}`);
        if (p.html_sidebar) {
          html_sidebar.push(p.html_sidebar);
        }
      } else {
        successful_count++;
      }
    });

    console.log('Upserting prices to Supabase...');
    const prices_to_upsert = prices.map(p => ({
      price: p.price,
      room_id: p.room_id,
      total: p.total,
      date_range: p.date_range
    }));
    
    await supabase_service.upsert_prices(prices_to_upsert);
    console.log('Successfully updated prices for', prices.length, 'records');
  } catch (error) {
    console.error('Error during execution:', error);
    if (error instanceof Error) {
      error_messages.push(`Global error: ${error.message}`);
    } else {
      error_messages.push('Global error: Unknown error occurred');
    }
  } finally {
    const execution_time = `${((Date.now() - start_time) / 1000).toFixed(2)} seconds`;
    
    // Calculate failed count
    const failed_count = failed_room_ids.length;

    // Prepare log data
    const log_data = {
      room_ids,
      execution_time,
      error_messages: error_messages.length > 0 ? error_messages : null,
      failed_room_ids: failed_room_ids.length > 0 ? failed_room_ids : null,
      failed_count,
      successful_count,
      html_sidebar: html_sidebar.length > 0 ? html_sidebar : null
    };

    // Insert log
    await supabase_service.log_execution(log_data);
  }
}

main(); 