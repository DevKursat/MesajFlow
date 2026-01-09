
import { createClient } from '@supabase/supabase-js';
import { Transaction, Iban, AiSettings, WhatsAppConnection, WhatsAppMessage } from '../types';

export const SUPABASE_SQL_SETUP = `-- 1. SIFIRLA
DROP PUBLICATION IF EXISTS supabase_realtime;
DROP TABLE IF EXISTS public.system_logs, public.whatsapp_messages, public.whatsapp_connections, public.menu_items, public.menu_categories, public.products, public.product_categories, public.orders, public.customers, public.ai_settings, public.ibans, public.transactions CASCADE;

-- 2. ANA TABLOLAR
CREATE TABLE public.ai_settings (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_name TEXT NOT NULL UNIQUE,
  business_type TEXT DEFAULT 'RESTAURANT', -- 'RESTAURANT' veya 'ECOMMERCE'
  system_password TEXT NOT NULL,
  tone TEXT DEFAULT 'SAMIMI',
  delay_seconds INTEGER DEFAULT 3,
  ai_instruction TEXT,
  human_simulation BOOLEAN DEFAULT true,
  use_whatsapp BOOLEAN DEFAULT true,
  use_telegram BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. MÜŞTERİLER
CREATE TABLE public.customers (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.ai_settings(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  name TEXT,
  email TEXT,
  address TEXT,
  note TEXT,
  total_orders INTEGER DEFAULT 0,
  total_spent NUMERIC DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. SİPARİŞLER
CREATE TABLE public.orders (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.ai_settings(id) ON DELETE CASCADE,
  customer_id uuid REFERENCES public.customers(id),
  order_number TEXT,
  status TEXT DEFAULT 'PENDING', -- PENDING, CONFIRMED, PREPARING, SHIPPED, DELIVERED, CANCELLED
  items JSONB DEFAULT '[]', -- [{name, quantity, price, item_id}]
  subtotal NUMERIC DEFAULT 0,
  delivery_fee NUMERIC DEFAULT 0,
  total NUMERIC DEFAULT 0,
  note TEXT,
  address TEXT,
  customer_phone TEXT,
  customer_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 5. RESTORAN: MENÜ KATEGORİLERİ
CREATE TABLE public.menu_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.ai_settings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 6. RESTORAN: MENÜ ÖĞELERİ
CREATE TABLE public.menu_items (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.ai_settings(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.menu_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  image_url TEXT,
  is_available BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 7. E-TİCARET: ÜRÜN KATEGORİLERİ
CREATE TABLE public.product_categories (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.ai_settings(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 8. E-TİCARET: ÜRÜNLER
CREATE TABLE public.products (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.ai_settings(id) ON DELETE CASCADE,
  category_id uuid REFERENCES public.product_categories(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  price NUMERIC NOT NULL DEFAULT 0,
  stock INTEGER DEFAULT 0,
  sku TEXT,
  image_url TEXT,
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 9. WHATSAPP BAĞLANTILARI
CREATE TABLE public.whatsapp_connections (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  business_id uuid REFERENCES public.ai_settings(id) ON DELETE CASCADE,
  name TEXT,
  representative_name TEXT DEFAULT 'Destek',
  status TEXT DEFAULT 'INITIALIZING',
  phone_number TEXT,
  qr_code TEXT,
  pairing_code TEXT,
  battery_level INTEGER DEFAULT 100,
  last_seen TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 10. WHATSAPP MESAJLARI
CREATE TABLE public.whatsapp_messages (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid REFERENCES public.whatsapp_connections(id) ON DELETE CASCADE,
  wa_message_id TEXT,
  sender_phone TEXT,
  target_phone TEXT,
  message_text TEXT,
  is_from_me BOOLEAN DEFAULT false,
  is_outgoing BOOLEAN DEFAULT false,
  is_media BOOLEAN DEFAULT false,
  media_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 11. SİSTEM LOGLARI
CREATE TABLE public.system_logs (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  severity TEXT DEFAULT 'ERROR',
  module TEXT,
  message TEXT,
  stack_trace TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 12. ESKİ TABLOLAR (geriye uyumluluk)
CREATE TABLE public.transactions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  connection_id uuid,
  iban_id uuid,
  sender_name TEXT,
  username TEXT,
  amount NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'PENDING',
  created_at TIMESTAMPTZ DEFAULT now(),
  receipt_url TEXT,
  bank_name TEXT,
  customer_phone TEXT,
  wa_message_id TEXT
);

CREATE TABLE public.ibans (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  bank_name TEXT,
  account_holder TEXT,
  iban_number TEXT UNIQUE,
  is_active BOOLEAN DEFAULT true,
  usage_count INTEGER DEFAULT 0,
  limit_amount NUMERIC DEFAULT 100000,
  current_total NUMERIC DEFAULT 0,
  priority INTEGER DEFAULT 1,
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS & GRANTS
ALTER TABLE public.ai_settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.menu_items DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.product_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_connections DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ibans DISABLE ROW LEVEL SECURITY;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- REALTIME
ALTER TABLE public.orders REPLICA IDENTITY FULL;
ALTER TABLE public.customers REPLICA IDENTITY FULL;
ALTER TABLE public.menu_items REPLICA IDENTITY FULL;
ALTER TABLE public.products REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_connections REPLICA IDENTITY FULL;
ALTER TABLE public.whatsapp_messages REPLICA IDENTITY FULL;
ALTER TABLE public.ai_settings REPLICA IDENTITY FULL;

CREATE PUBLICATION supabase_realtime FOR TABLE 
    public.orders, public.customers, public.menu_items, public.products, 
    public.whatsapp_connections, public.whatsapp_messages, public.ai_settings;

-- DEMO VERİ
INSERT INTO public.ai_settings (business_name, business_type, system_password, tone, ai_instruction) 
VALUES 
  ('Demo Restoran', 'RESTAURANT', '122112', 'SAMIMI', 'Sen bir restoran müşteri destek asistanısın. Menü, sipariş ve rezervasyon konularında yardımcı ol. Müşterilere güncel menüyü paylaş.'),
  ('Demo E-Ticaret', 'ECOMMERCE', '122112', 'PRO', 'Sen bir e-ticaret müşteri destek asistanısın. Ürünler, sipariş takibi ve iade konularında yardımcı ol. Profesyonel ve hızlı yanıt ver.')
ON CONFLICT (business_name) DO NOTHING;
`;

// @ts-ignore - Vite environment variables
const supabaseUrl = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) || 'https://wtpfwwgtofpybomfmhnk.supabase.co';
// @ts-ignore - Vite environment variables
const supabaseKey = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_KEY) || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Ind0cGZ3d2d0b2ZweWJvbWZtaG5rIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzcwMTY2NywiZXhwIjoyMDgzMjc3NjY3fQ.dAvFwxXxH5LBoka95kyOkVW09IBHbZ3m2hylNIA9YAg';

export const supabase = createClient(supabaseUrl, supabaseKey);

import { BusinessType } from '../types';

// İşletme adı ve şifre ile giriş
export const loginBusiness = async (businessName: string, password: string): Promise<AiSettings | null> => {
  try {
    const { data, error } = await supabase
      .from('ai_settings')
      .select('*')
      .eq('business_name', businessName)
      .maybeSingle();

    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation "public.ai_settings" does not exist')) {
        const err = new Error("DB_TABLE_MISSING");
        (err as any).code = 'DB_TABLE_MISSING';
        throw err;
      }
      throw error;
    }

    if (!data) return null;
    if (data.system_password !== password) return null;

    return data as AiSettings;
  } catch (err: any) {
    if (err.code === 'DB_TABLE_MISSING') throw err;
    return null;
  }
};

// Yeni işletme kaydı
export const registerBusiness = async (
  businessName: string,
  password: string,
  businessType: BusinessType,
  useWhatsapp: boolean = true,
  useTelegram: boolean = false
): Promise<AiSettings> => {
  try {
    const defaultInstruction = businessType === 'RESTAURANT'
      ? 'Sen bir restoran müşteri destek asistanısın. Menü, sipariş ve rezervasyon konularında yardımcı ol. Samimi ve çözüm odaklı ol.'
      : 'Sen bir e-ticaret müşteri destek asistanısın. Ürün, sipariş takibi ve iade konularında yardımcı ol. Profesyonel ve hızlı yanıt ver.';

    const { data, error } = await supabase
      .from('ai_settings')
      .insert([{
        business_name: businessName,
        business_type: businessType,
        system_password: password,
        tone: 'SAMIMI',
        ai_instruction: defaultInstruction,
        human_simulation: true,
        delay_seconds: 3,
        use_whatsapp: useWhatsapp,
        use_telegram: useTelegram
      }])
      .select()
      .single();

    if (error) throw error;
    return data as AiSettings;
  } catch (err: any) {
    logError('Register', 'İşletme kaydı başarısız', err);
    throw err;
  }
};

export const initializeSettings = async () => {
  try {
    const { error } = await supabase.from('ai_settings').insert([{
      business_name: 'Demo Restoran',
      business_type: 'RESTAURANT',
      system_password: '122112',
      tone: 'SAMIMI',
      ai_instruction: 'Sen bir restoran müşteri destek asistanısın.',
    }]);
    if (error && error.code !== '23505') throw error;
    return true;
  } catch (err) {
    console.error("Initialization failed:", err);
    throw err;
  }
};

export const logError = async (module: string, message: string, error?: any, severity: 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' = 'ERROR') => {
  let errorDetails = error ? (typeof error === 'object' ? JSON.stringify(error, Object.getOwnPropertyNames(error)) : String(error)) : '';
  try {
    await supabase.from('system_logs').insert([{ severity, module, message, stack_trace: errorDetails }]);
  } catch (e) { }
};

// Belirli işletmenin ayarlarını getir
export const fetchAiSettings = async (businessId?: string): Promise<AiSettings | null> => {
  try {
    let query = supabase.from('ai_settings').select('*');

    if (businessId) {
      query = query.eq('id', businessId);
    } else {
      // Geriye dönük uyumluluk için ilk kaydı getir
      query = query.limit(1);
    }

    const { data, error } = await query.maybeSingle();
    if (error) {
      if (error.code === 'PGRST116' || error.message.includes('relation "public.ai_settings" does not exist')) {
        const err = new Error("DB_TABLE_MISSING");
        (err as any).code = 'DB_TABLE_MISSING';
        throw err;
      }
      throw error;
    }
    return data;
  } catch (err: any) {
    if (err.code === 'DB_TABLE_MISSING') throw err;
    return null;
  }
};

export const updateAiSettings = async (businessId: string, settings: Partial<AiSettings>) => {
  try {
    const { error } = await supabase.from('ai_settings').update(settings).eq('id', businessId);
    if (error) throw error;
  } catch (err) {
    logError('Settings', 'AI ayarları güncellenemedi', err);
    throw err;
  }
};

// Tüm işletmeleri getir (admin için)
export const fetchAllBusinesses = async (): Promise<AiSettings[]> => {
  try {
    const { data, error } = await supabase
      .from('ai_settings')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as AiSettings[];
  } catch (err) {
    logError('Admin', 'İşletmeler getirilemedi', err);
    return [];
  }
};

// İşletme sil (admin için)
export const deleteBusiness = async (businessId: string) => {
  try {
    const { error } = await supabase.from('ai_settings').delete().eq('id', businessId);
    if (error) throw error;
  } catch (err) {
    logError('Admin', 'İşletme silinemedi', err);
    throw err;
  }
};

export const fetchTransactions = async (): Promise<Transaction[]> => {
  try {
    const { data, error } = await supabase.from('transactions').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return (data || []) as Transaction[];
  } catch (err) {
    logError('Transactions', 'İşlemler çekilemedi', err);
    return [];
  }
};

/**
 * İşlem durumunu günceller ve eğer bakiye yüklendiyse IBAN istatistiklerini artırır.
 */
export const updateTransactionStatus = async (id: string, status: string) => {
  try {
    // 1. İşlemin mevcut verilerini al
    const { data: tx, error: fetchError } = await supabase.from('transactions').select('*').eq('id', id).single();
    if (fetchError) throw fetchError;

    // 2. Durumu güncelle
    const { error: updateError } = await supabase.from('transactions').update({ status }).eq('id', id);
    if (updateError) throw updateError;

    // 3. Eğer durum CREDITED (Bakiye Yüklendi) ise IBAN'ı güncelle
    if (status === 'CREDITED' && tx.iban_id) {
      const { data: iban } = await supabase.from('ibans').select('current_total, usage_count').eq('id', tx.iban_id).single();
      if (iban) {
        await supabase.from('ibans').update({
          current_total: (Number(iban.current_total) || 0) + (Number(tx.amount) || 0),
          usage_count: (Number(iban.usage_count) || 0) + 1
        }).eq('id', tx.iban_id);
      }
    }
  } catch (err) {
    logError('Transactions', `İşlem durumu güncellenemedi (ID: ${id})`, err);
    throw err;
  }
};

export const fetchIbans = async (): Promise<Iban[]> => {
  try {
    const { data, error } = await supabase.from('ibans').select('*').order('priority', { ascending: false });
    if (error) throw error;
    return (data || []).map(i => ({
      ...i,
      limit: i.limit_amount || 0,
      current_total: i.current_total || 0,
      usage_count: i.usage_count || 0
    }));
  } catch (err) {
    return [];
  }
};

export const addIban = async (iban: Partial<Iban>) => {
  try {
    const { data, error } = await supabase.from('ibans').insert([{
      bank_name: iban.bank_name,
      account_holder: iban.account_holder,
      iban_number: iban.iban_number,
      limit_amount: iban.limit,
      priority: iban.priority,
      description: iban.description,
      is_active: true
    }]).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    throw err;
  }
};

export const updateIban = async (id: string, updates: Partial<Iban>) => {
  try {
    const dbUpdates: any = { ...updates };
    if (updates.limit !== undefined) {
      dbUpdates.limit_amount = updates.limit;
      delete dbUpdates.limit;
    }
    const { error } = await supabase.from('ibans').update(dbUpdates).eq('id', id);
    if (error) throw error;
  } catch (err) {
    throw err;
  }
};

export const deleteIban = async (id: string) => {
  try {
    const { error } = await supabase.from('ibans').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    throw err;
  }
};

export const fetchConnections = async () => {
  try {
    const { data, error } = await supabase.from('whatsapp_connections').select('*').order('created_at', { ascending: false });
    if (error) throw error;
    return data || [];
  } catch (err) {
    return [];
  }
};

export const createConnection = async (name: string, representative: string, phone?: string) => {
  try {
    const { data, error } = await supabase.from('whatsapp_connections').insert([{
      name,
      representative_name: representative,
      phone_number: phone,
      status: 'INITIALIZING'
    }]).select().single();
    if (error) throw error;
    return data;
  } catch (err) {
    throw err;
  }
};

export const deleteConnection = async (id: string) => {
  try {
    const { error } = await supabase.from('whatsapp_connections').delete().eq('id', id);
    if (error) throw error;
  } catch (err) {
    throw err;
  }
};

export const fetchMessages = async (connectionId: string) => {
  try {
    const { data, error } = await supabase.from('whatsapp_messages').select('*').eq('connection_id', connectionId).order('created_at', { ascending: true });
    if (error) throw error;
    return data || [];
  } catch (err) {
    return [];
  }
};

export const sendMessageToDb = async (message: Partial<WhatsAppMessage>) => {
  try {
    const { error } = await supabase.from('whatsapp_messages').insert([message]);
    if (error) throw error;
  } catch (err) {
    throw err;
  }
};

export const subscribeToTable = (table: string, onEvent: (payload: any) => void) => {
  return supabase.channel(`realtime_${table}`).on('postgres_changes', { event: '*', schema: 'public', table: table }, (payload) => onEvent(payload)).subscribe();
};
