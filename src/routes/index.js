import { Router } from 'express';
import userRoutes from './user.routes.js';

const router = Router();

// Định tuyến API người dùng: /api/v1/users
router.use('/users', userRoutes);

export default router;
