export interface PropertyData {
  url: string;
  price: number | null;
  label: string;
  date_range: string;
  host_name: string;
  room_id: string;
  total: number | null;
  error?: string;
  html_sidebar?: string;
} 