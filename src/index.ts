import express, { Request, Response } from 'express';
import { scrape_prices } from './services/scraper_service';
import { addDays, format, parseISO, isValid } from 'date-fns';
import cors from 'cors';
import { createClient } from '@supabase/supabase-js';

const app: express.Application = express();
app.use(express.json());
app.use(cors());

interface RequestBody {
  room_ids: string[];
  start_date: string;
  days: number;
  concurrency?: number;
}

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

  async upsert_prices(prices: { price: number | null; room_id: string; total: number | null; date_range: string }[]): Promise<void> {
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

app.post('/scrape', (req: Request<{}, any, RequestBody>, res: Response) => {
  const handler = async () => {
    try {
      const { room_ids, start_date, days, concurrency = 7 }: RequestBody = req.body;
      
      // If room_ids is not provided, fetch from Supabase
      const final_room_ids = room_ids || await supabase_service.get_room_ids();
      
      if (!final_room_ids || final_room_ids.length === 0) {
        return res.status(400).json({ error: 'No room ids available' });
      }

      if (!start_date || !days) {
        return res.status(400).json({ error: 'Missing required parameters' });
      }

      if (!isValid(parseISO(start_date))) {
        return res.status(400).json({ error: 'Invalid date format. Please use YYYY-MM-DD' });
      }

      if (typeof days !== 'number' || days <= 0) {
        return res.status(400).json({ error: 'days must be a positive number' });
      }

      const start_time = Date.now();
      const property_urls = generate_urls(final_room_ids, parseISO(start_date), days);
      const prices = await scrape_prices(property_urls, concurrency);
      
      const end_time = Date.now();
      const total_seconds = ((end_time - start_time) / 1000).toFixed(2);

      // Upsert prices into Supabase
      const prices_to_upsert = prices.map(p => ({
        price: p.price,
        room_id: p.room_id,
        total: p.total,
        date_range: p.date_range
      }));
      await supabase_service.upsert_prices(prices_to_upsert);
      
      res.json({
        success: true,
        execution_time: `${total_seconds} seconds`,
        total_results: prices.length,
        results: prices
      });
    } catch (error) {
      console.error('Error:', error);
      res.status(500).json({ 
        success: false,
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  };
  handler();
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
}); 