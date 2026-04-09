// apps/api/src/routes/dashboard.ts
import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { StatsController } from '../controllers/StatsController'; 

// 🛡️ SECURITY FIX: Replaced old auth with authenticateToken
import { authenticateToken } from '../middleware/AuthMiddleware';
import { requireAdmin, requirePosAccess } from '../middleware/RoleMiddleware';

const router = Router();

// ✅ STATS
router.get('/stats', authenticateToken, requirePosAccess, StatsController.getGlobalStats);

// ✅ SILO B PRODUCTS
router.get('/products', authenticateToken, requirePosAccess, DashboardController.getProducts);
router.post('/products', authenticateToken, requireAdmin, DashboardController.createProduct);
router.put('/products/:id', authenticateToken, requireAdmin, DashboardController.updateProduct);
router.delete('/products/:id', authenticateToken, requireAdmin, DashboardController.deleteProduct);

// ✅ TRANSACTIONS & PAYMENTS
router.post('/transactions', authenticateToken, requirePosAccess, DashboardController.createTransaction);
router.post('/payment', authenticateToken, requirePosAccess, DashboardController.createPayment);

// ✅ GLOBAL HISTORY 
router.get('/history', authenticateToken, requireAdmin, DashboardController.getHistory);
router.get('/clients/:clientId/statement', authenticateToken, DashboardController.getClientStatement);
router.get('/clients/:id/global', authenticateToken, requireAdmin, DashboardController.getGlobalClientDetails);

export default router;