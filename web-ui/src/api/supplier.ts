import client from './client';

export const SupplierService = {
  // 1. Get all suppliers (Legal or Internal)
  getAll: async (mode: 'LEGAL' | 'INTERNAL', params?: { page?: number; limit?: number; search?: string }) => {
    // Determine the correct endpoint based on the mode
    const endpoint = mode === 'LEGAL' ? '/suppliers' : '/internal/suppliers';
    const response = await client.get(endpoint, { params });
    return response.data;
  },

  // 2. Create a supplier
  create: async (mode: 'LEGAL' | 'INTERNAL', data: any) => {
    const endpoint = mode === 'LEGAL' ? '/suppliers' : '/internal/suppliers';
    const response = await client.post(endpoint, data);
    return response.data;
  },

  // 3. Update a supplier
  update: async (mode: 'LEGAL' | 'INTERNAL', id: string, data: any) => {
    const endpoint = mode === 'LEGAL' ? `/suppliers/${id}` : `/internal/suppliers/${id}`;
    const response = await client.put(endpoint, data);
    return response.data;
  },

  // 4. Delete a supplier
  delete: async (mode: 'LEGAL' | 'INTERNAL', id: string) => {
    const endpoint = mode === 'LEGAL' ? `/suppliers/${id}` : `/internal/suppliers/${id}`;
    const response = await client.delete(endpoint);
    return response.data;
  }
};