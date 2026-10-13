import { Router } from 'express';
import AddressController from '../controllers/address.controller.js';

const router = Router();

// ADR06: Danh sách tỉnh thành
router.get('/provinces', AddressController.getProvinces);

// ADR07: Danh sách phường xã
router.get('/wards', AddressController.getWards);

export default router;
