import fs from 'fs';
import { PropertyData } from '../types/types';

export function save_to_json(data: PropertyData[], file_path = './data/output.json') {
  fs.writeFileSync(file_path, JSON.stringify(data, null, 2));
} 