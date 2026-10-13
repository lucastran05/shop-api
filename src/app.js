import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes/index.js';
import adminRoutes from './routes/admin.routes.js';

import errorHandler from './common/middlewares/errorHandler.js';

const app = express();

// Core Middlewares
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(morgan('dev'));

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'success',
    message: 'Shop API is running smoothly',
    timestamp: new Date().toISOString(),
  });
});

// Root API Router
app.use('/api/v1', apiRoutes);

// Admin API Router (METHOD /admin/... theo hợp đồng tài liệu)
app.use('/admin', adminRoutes);
app.use('/api/v1/admin', adminRoutes);

// 404 Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Resource not found: ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
