// apps/api/src/routes/purchase.routes.ts
import { Router } from 'express';
import { PurchaseController } from '../controllers/PurchaseController';
import { authenticateToken } from '../middleware/AuthMiddleware';
import { requireLegalAccess } from '../middleware/RoleMiddleware';

const router = Router();

// 🛑 SECURITY FIX: Locked route to Legal/Admin context
router.use(authenticateToken, requireLegalAccess);

router.post('/', PurchaseController.create);
router.get('/', PurchaseController.getAll);

export default router;