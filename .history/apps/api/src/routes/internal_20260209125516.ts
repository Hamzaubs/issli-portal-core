import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
import { authenticateToken } from '../middleware/AuthMiddleware';

const router = Router();

// ✅ SECURITY: All Internal Stock operations require authentication
router.use(authenticateToken);

// 📦 Products
router.get('/products', InternalController.getProducts);
router.post('/products', InternalController.createProduct);
router.put('/products/:id', InternalController.updateProduct);
router.delete('/products/:id', InternalController.deleteProduct);

// 💰 Transactions
router.get('/transactions', InternalController.getTransactions);
router.post('/transactions', InternalController.createTransaction); // Single
router.post('/transactions/batch', InternalController.createBatchTransaction); // ✅ BATCH QUOTE ONLY
router.post('/transactions/:id/void', InternalController.voidTransaction); // Safe Void

// Note: Conversion route removed per user request.

export default router;