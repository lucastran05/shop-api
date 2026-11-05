import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import path from 'node:path';
import apiRoutes from './routes/index.js';
import adminRoutes from './routes/admin.routes.js';
import { serveStoredImage } from './services/upload-storage.js';

import errorHandler from './common/middlewares/errorHandler.js';

const app = express();
const allowedOrigins = new Set(
  String(process.env.CLIENT_URL || "http://localhost:5173")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

// Core Middlewares
app.use(helmet());
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(null, false);
    },
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Idempotency-Key"],
    maxAge: 600,
  }),
);
app.use(express.json({
  limit: process.env.JSON_BODY_LIMIT || "1mb",
  verify(req, res, buffer) {
    if (/^\/api\/v1\/payments\/webhooks?(?:\/|$)/.test(req.url.split('?')[0])) req.rawBody = buffer;
  },
}));
app.use(express.urlencoded({ extended: true, limit: process.env.JSON_BODY_LIMIT || "1mb" }));
app.use(morgan('dev'));
app.get('/uploads/:fileName', serveStoredImage);
app.use(
  '/uploads',
  express.static(path.resolve(process.env.UPLOAD_DIR || 'uploads'), {
    dotfiles: 'deny',
    index: false,
    maxAge: '1y',
    immutable: true,
  }),
);

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
app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Resource not found: ${req.originalUrl}`,
  });
});

// Global Error Handler
app.use(errorHandler);

export default app;
