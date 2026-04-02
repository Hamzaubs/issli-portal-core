import { Router } from 'express';
import { SupplierController } from '../controllers/supplier.controller';
// If you have authentication middleware (like requireAuth), import it here!

const router = Router();

// Define the routes
router.post('/', SupplierController.create);
router.get('/', SupplierController.getAll);
router.get('/:id', SupplierController.getById);
router.put('/:id', SupplierController.update);
router.delete('/:id', SupplierController.delete);

export default router;