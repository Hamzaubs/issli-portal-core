import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
import { authenticateToken } from '../middleware/AuthMiddleware';

const router = Router();

// ✅ SECURITY: All Internal Stock operations require authentication
router.use(authenticateToken);

// ==========================================
// 📦 STOCK B PRODUCT MANAGEMENT
// ==========================================
router.get('/products', InternalController.getProducts);
router.post('/products', InternalController.createProduct);
router.put('/products/:id', InternalController.updateProduct);
router.delete('/products/:id', InternalController.deleteProduct);

// ==========================================
// 💰 TRANSACTION ENGINE (Add/Sell/Return/Void)
// ==========================================
router.get('/transactions', InternalController.getTransactions); // ✅ HISTORY
router.post('/transactions', InternalController.createTransaction); // ✅ NEW SALE
router.post('/transactions/:id/void', InternalController.voidTransaction); // ✅ SAFE CANCEL

export default router;