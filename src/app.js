import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import apiRoutes from './routes/index.js';

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

// 404 Not Found Handler
app.use((req, res, next) => {
  res.status(404).json({
    status: 'error',
    message: `Resource not found: ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use((err, req, res, next) => {
  const statusCode = err.statusCode || 500;

  // Ghi log lỗi phía server nếu là lỗi nghiêm trọng (500)
  if (statusCode >= 500) {
    console.error('💥 Lỗi máy chủ:', err);
  }

  res.status(statusCode).json({
    status: 'error',
    message: err.message || 'Internal Server Error',
  });
});

export default app;
