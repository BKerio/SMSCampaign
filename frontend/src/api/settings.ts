import api from '@/api/client';
import type { SmsGatewaySummary, SmsProvider, SmsTestResult } from '@/types/api';

export async function listSmsGateways(): Promise<SmsGatewaySummary[]> {
  const res = await api.get('/settings/sms-gateways');
  return res.data.data;
}

export async function updateSmsGateway(provider: SmsProvider, fields: Record<string, string>): Promise<SmsGatewaySummary> {
  const res = await api.put(`/settings/sms-gateways/${provider}`, fields);
  return res.data.data;
}

export async function activateSmsGateway(provider: SmsProvider): Promise<SmsGatewaySummary> {
  const res = await api.post(`/settings/sms-gateways/${provider}/activate`);
  return res.data.data;
}

export async function deactivateSmsGateway(provider: SmsProvider): Promise<SmsGatewaySummary> {
  const res = await api.post(`/settings/sms-gateways/${provider}/deactivate`);
  return res.data.data;
}

export async function testSmsGateway(provider: SmsProvider): Promise<SmsTestResult> {
  const res = await api.post(`/settings/sms-gateways/${provider}/test`);
  return res.data.data;
}
