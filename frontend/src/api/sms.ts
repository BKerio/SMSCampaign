import api from '@/api/client';

export interface SmsBalance {
  enabled: boolean;
  credit: number | null;
  shortcode: string | null;
}

export async function getSmsBalance(): Promise<SmsBalance> {
  const res = await api.get('/sms/balance');
  return res.data.data;
}
