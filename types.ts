
export type TransactionStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CREDITED';

export interface Transaction {
  id: string;
  connection_id?: string;
  sender_name: string;
  username?: string; // Casino kullanıcı adı
  amount: number;
  status: TransactionStatus;
  created_at: string;
  receipt_url?: string;
  bank_name?: string;
  customer_phone?: string;
  wa_message_id?: string;
}

export interface Iban {
  id: string;
  bank_name: string;
  account_holder: string;
  iban_number: string;
  usage_count: number;
  is_active: boolean;
  limit: number;
  current_total: number;
  priority: number; // 1-10 arası, yüksek olan önce gelir
  description?: string; // Kişiselleştirilmiş notlar/etiketler
  created_at: string;
}

export type AiTone = 'SAMIMI' | 'PRO' | 'AGRESIF' | 'KURUMSAL';
export type BusinessType = 'RESTAURANT' | 'ECOMMERCE';

export interface AiSettings {
  id: string;
  business_name: string;
  business_type: BusinessType;
  tone: AiTone;
  delay_seconds: number;
  system_password: string;
  ai_instruction: string;
  human_simulation: boolean; // Yazım hatası vs yapma
  created_at?: string;
}

export interface WhatsAppConnection {
  id: string;
  name: string;
  representative_name: string; // Temsilci ismi
  status: 'INITIALIZING' | 'QR_READY' | 'PAIRING_READY' | 'CONNECTED' | 'ERROR' | 'DISCONNECTED' | 'RECONNECTING';
  phone_number?: string;
  qr_code?: string;
  pairing_code?: string;
  battery_level: number;
  last_seen: string;
  created_at: string;
}

export interface WhatsAppMessage {
  id: string;
  connection_id: string;
  wa_message_id?: string;
  sender_phone: string;
  target_phone?: string;
  message_text: string;
  is_from_me: boolean;
  is_outgoing?: boolean;
  is_processed?: boolean;
  media_url?: string;
  is_media: boolean;
  created_at: string;
}

// Business Types
export type OrderStatus = 'PENDING' | 'CONFIRMED' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CANCELLED';

export interface Customer {
  id: string;
  business_id: string;
  phone: string;
  name?: string;
  email?: string;
  address?: string;
  note?: string;
  total_orders: number;
  total_spent: number;
  created_at: string;
}

export interface OrderItem {
  name: string;
  quantity: number;
  price: number;
  item_id?: string;
}

export interface Order {
  id: string;
  business_id: string;
  customer_id?: string;
  order_number?: string;
  status: OrderStatus;
  items: OrderItem[];
  subtotal: number;
  delivery_fee: number;
  total: number;
  note?: string;
  address?: string;
  customer_phone?: string;
  customer_name?: string;
  created_at: string;
  updated_at: string;
}

// Restaurant Types
export interface MenuCategory {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface MenuItem {
  id: string;
  business_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  image_url?: string;
  is_available: boolean;
  sort_order: number;
  created_at: string;
}

// E-commerce Types
export interface ProductCategory {
  id: string;
  business_id: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Product {
  id: string;
  business_id: string;
  category_id?: string;
  name: string;
  description?: string;
  price: number;
  stock: number;
  sku?: string;
  image_url?: string;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}
