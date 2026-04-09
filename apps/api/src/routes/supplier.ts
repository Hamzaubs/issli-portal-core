// apps/api/src/routes/supplier.routes.ts
import { Router } from 'express';
import { SupplierController } from '../controllers/SupplierController';
import { authenticateToken } from '../middleware/AuthMiddleware';
import { requireLegalAccess } from '../middleware/RoleMiddleware';

const router = Router();

// 🛑 SECURITY FIX: Locked route to Legal/Admin context
router.use(authenticateToken, requireLegalAccess);

router.post('/', SupplierController.create);
router.get('/', SupplierController.getAll);
router.get('/:id', SupplierController.getById);
router.put('/:id', SupplierController.update);
router.delete('/:id', SupplierController.delete);

export default router;