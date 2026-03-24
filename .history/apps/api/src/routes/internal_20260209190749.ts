import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
import { StatsController } from '../controllers/StatsController';
import { InternalClientController } from '../controllers/InternalClientController'; 
import { authenticateToken } from '../middleware/AuthMiddleware';

const router = Router();

router.use(authenticateToken);

// 📦 Products
router.get('/products', InternalController.getProducts);
router.post('/products', InternalController.createProduct);
router.put('/products/:id', InternalController.updateProduct);
router.delete('/products/:id', InternalController.deleteProduct);

// 💰 Transactions
router.get('/transactions', InternalController.getTransactions);
router.post('/transactions', InternalController.createTransaction); 
router.post('/transactions/batch', InternalController.createBatchTransaction); 
router.post('/transactions/:id/void', InternalController.voidTransaction);

// 📊 Analytics
router.get('/stats', StatsController.getGlobalStats);

// 👥 CLIENTS (BIG DATA OPTIMIZED)
router.get('/clients', InternalClientController.searchClients);
router.post('/clients', InternalClientController.createClient);
router.get('/clients/:id/details', InternalClientController.getClientDetails); 
router.get('/clients/:id/history', InternalClientController.getClientHistory); 
router.post('/clients/:id/payment', InternalClientController.registerPayment); // ✅ Payment
router.put('/clients/:id', InternalClientController.updateClient);
router.delete('/clients/:id', InternalClientController.deleteClient);

export default router;