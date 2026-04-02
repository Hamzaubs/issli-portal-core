import { Router } from 'express';
import { PurchaseController } from '../controllers/Purchase.controller';

const router = Router();

router.post('/', PurchaseController.create);
router.get('/', PurchaseController.getAll);

export default router;