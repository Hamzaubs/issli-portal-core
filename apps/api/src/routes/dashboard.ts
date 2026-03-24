// apps/api/src/routes/dashboard.ts
import { Router } from 'express';
import { DashboardController } from '../controllers/DashboardController';
import { StatsController } from '../controllers/StatsController'; // ✅ IMPORT ADDED
import { requireAuth } from '../middleware/auth';
import { requireAdmin, requirePosAccess } from '../middleware/RoleMiddleware';

const router = Router();

// ✅ STATS (God View - Big Data Optimized)
// Fixed: Now correctly points to StatsController to power the Global Dashboard
router.get('/stats', requireAuth, requirePosAccess, StatsController.getGlobalStats);

// ✅ SILO B PRODUCTS (Internal Stock)
router.get('/products', requireAuth, requirePosAccess, DashboardController.getProducts);
router.post('/products', requireAuth, requireAdmin, DashboardController.createProduct);
router.put('/products/:id', requireAuth, requireAdmin, DashboardController.updateProduct);
router.delete('/products/:id', requireAuth, requireAdmin, DashboardController.deleteProduct);

// ✅ TRANSACTIONS & PAYMENTS
router.post('/transactions', requireAuth, requirePosAccess, DashboardController.createTransaction);
router.post('/payment', requireAuth, requirePosAccess, DashboardController.createPayment);

// ✅ GLOBAL HISTORY (For "Relevé de Compte" PDF & Admin View)
router.get('/history', requireAuth, requireAdmin, DashboardController.getHistory);
router.get('/clients/:clientId/statement', requireAuth, DashboardController.getClientStatement);

// (Optional Legacy Support)
router.get('/clients/:id/global', requireAuth, requireAdmin, DashboardController.getGlobalClientDetails);

export default router;