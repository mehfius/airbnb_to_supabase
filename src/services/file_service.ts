import fs from 'fs';
import path from 'path';
import { PropertyData } from '../types/types';

export function save_to_json(data: PropertyData[], file_path = './data/output.json') {
  // Create data directory if it doesn't exist
  const dir = path.dirname(file_path);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  // Transform data into nested structure
  const nested_data = data.reduce((acc, item) => {
    const url = new URL(item.url);
    const room_id = url.pathname.split('/').pop() || 'unknown';
    
    if (!acc[room_id]) {
      acc[room_id] = {
        room_id,
        host_name: item.host_name,
        label: item.label,
        url: item.url,
        data: []
      };
    }
    
    // Check if this date range already exists
    const exists = acc[room_id].data.some((d: any) => d.date_range === item.date_range);
    if (!exists) {
      const price_number = item.price === 'N/A' || item.price === 'Dates not available' || item.price === 'Error' || item.price === 'Timeout' || item.price === 'Error loading page' 
        ? null 
        : parseFloat(item.price.replace(/[^0-9.,]/g, '').replace(',', '.'));
      
      const fee_number = item.fee === 'N/A' 
        ? null 
        : parseFloat(item.fee.replace(/[^0-9.,]/g, '').replace(',', '.'));
      
      // Convert dates to timestamps first
      const start_date = new Date(item.date_range.split(' to ')[0]).getTime();
      const end_date = new Date(item.date_range.split(' to ')[1]).getTime();
      const days = (end_date - start_date) / (1000 * 60 * 60 * 24);
      
      const total = price_number !== null && fee_number !== null 
        ? (price_number * days) + fee_number 
        : null;
      
      acc[room_id].data.push({
        price: item.price === 'N/A' || item.price === 'Dates not available' || item.price === 'Error' || item.price === 'Timeout' || item.price === 'Error loading page' 
          ? null 
          : item.price,
        fee: item.fee === 'N/A' ? null : item.fee,
        date_range: item.date_range,
        total: total !== null ? total.toFixed(2) : null,
        special_offer: item.special_offer,
        checked_url: item.checked_url
      });
    }
    
    return acc;
  }, {} as Record<string, any>);

  // Convert to array and save
  const result = Object.values(nested_data);
  fs.writeFileSync(file_path, JSON.stringify(result, null, 2));
} 