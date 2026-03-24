import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
import { StatsController } from '../controllers/StatsController'; // ✅ Import
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

// 📊 ANALYTICS & STATS (The New Brain)
router.get('/stats', StatsController.getGlobalStats); // ✅ NEW ROUTE

export default router;