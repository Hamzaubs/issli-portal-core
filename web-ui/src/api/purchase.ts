import client from './client';

export const PurchaseService = {
  getAll: async (mode: 'LEGAL' | 'INTERNAL', params?: { supplierId?: string; type?: string }) => {
    const endpoint = mode === 'LEGAL' ? '/purchases' : '/internal/purchases';
    const response = await client.get(endpoint, { params });
    return response.data;
  },

  create: async (mode: 'LEGAL' | 'INTERNAL', data: any) => {
    const endpoint = mode === 'LEGAL' ? '/purchases' : '/internal/purchases';
    const response = await client.post(endpoint, data);
    return response.data;
  }
};