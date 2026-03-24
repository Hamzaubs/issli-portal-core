import { Router } from 'express';
import { InternalController } from '../controllers/InternalController';
// ✅ FIX: Import the correct named export from your existing file
import { authenticateToken } from '../middleware/AuthMiddleware';

const router = Router();

// ✅ SECURITY: Apply your existing token check
router.use(authenticateToken);

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
router.post('/transactions', InternalController.createTransaction);

export default router;