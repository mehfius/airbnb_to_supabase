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
      acc[room_id].data.push({
        price: item.price,
        fee: item.fee,
        date_range: item.date_range
      });
    }
    
    return acc;
  }, {} as Record<string, any>);

  // Convert to array and save
  const result = Object.values(nested_data);
  fs.writeFileSync(file_path, JSON.stringify(result, null, 2));
} 