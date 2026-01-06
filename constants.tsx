
import React from 'react';

export const COLORS = {
  primary: '#10b981', // Emerald 500
  secondary: '#f59e0b', // Amber 500
  danger: '#ef4444', // Red 500
  bg: '#0a0a0b',
  card: '#18181b',
};

// Fix: Updated TONE_LABELS keys (SAMIMI, PRO, AGRESIF) to match the AiTone type defined in types.ts
export const TONE_LABELS: Record<string, string> = {
  SAMIMI: 'Dost Ağzı (Kral, Hocam)',
  PRO: 'Kurumsal (Değerli Üyemiz)',
  AGRESIF: 'Sert (Hızlı İşlem)',
};

export const STATUS_LABELS: Record<string, string> = {
  PENDING: 'Onay Bekliyor',
  APPROVED: 'Onaylandı',
  REJECTED: 'Reddedildi',
  CREDITED: 'Bakiye Yüklendi',
};
