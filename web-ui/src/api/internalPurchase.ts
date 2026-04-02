import client from './client';

export const InternalPurchaseService = {
  getSuppliers: async () => {
    const res = await client.get('/internal/suppliers'); 
    return res.data;
  },
  createSupplier: async (data: any) => {
    const res = await client.post('/internal/suppliers', data);
    return res.data;
  },
  getPurchases: async () => {
    const res = await client.get('/internal/purchases');
    return res.data;
  },
  createPurchase: async (data: any) => {
    const res = await client.post('/internal/purchases', data);
    return res.data;
  }
};