import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
import { AuthMiddleware } from '../middleware/AuthMiddleware';

const router = Router();

// ✅ SECURITY: All Internal Stock operations require authentication
router.use(AuthMiddleware);

// ==========================================
// 📦 STOCK B PRODUCT MANAGEMENT
// ==========================================
router.get('/products', InternalController.getProducts);
router.post('/products', InternalController.createProduct);
router.put('/products/:id', InternalController.updateProduct);
router.delete('/products/:id', InternalController.deleteProduct);

// ==========================================
// 💰 TRANSACTION ENGINE (Add/Sell/Return)
// ==========================================
// This endpoint now uses the "Invincibility Protocol" (Atomic Transactions)
router.post('/transactions', InternalController.createTransaction);

export default router;