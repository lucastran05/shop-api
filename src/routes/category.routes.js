import { Router } from 'express';
import CategoryController from '../controllers/category.controller.js';

const router = Router();

// CAT03: Danh sách danh mục sản phẩm (công khai)
router.get('/', CategoryController.getAll);

export default router;
