# ==============================================================================
# Multi-Stage Dockerfile for Shop API (Node.js 22 + Express ES Modules)
# ==============================================================================

# ------------------------------------------------------------------------------
# Stage 1: Base Environment
# Sử dụng mirror Amazon ECR Public Gallery để tránh lỗi 429 Too Many Requests từ Docker Hub
# ------------------------------------------------------------------------------
FROM public.ecr.aws/docker/library/node:22-alpine AS base

WORKDIR /app

# Cài đặt curl để hỗ trợ container healthcheck
RUN apk add --no-cache curl

# ------------------------------------------------------------------------------
# Stage 2: Dependencies Cache Layer
# ------------------------------------------------------------------------------
FROM base AS dependencies

COPY package*.json ./

# Cài đặt đầy đủ dependencies (bao gồm devDependencies cho development & test)
RUN npm ci

# ------------------------------------------------------------------------------
# Stage 3: Development Target (Hot reload với volume mount)
# ------------------------------------------------------------------------------
FROM dependencies AS development

ENV NODE_ENV=development

# Copy toàn bộ mã nguồn và đảm bảo file .env mặc định luôn tồn tại
COPY . .
RUN (cp -n .env.example .env 2>/dev/null || touch .env) && chown -R node:node /app

USER node

EXPOSE 5000

# Khởi chạy chế độ dev với built-in watcher
CMD ["npm", "run", "dev"]

# ------------------------------------------------------------------------------
# Stage 4: Production Target (Tối ưu dung lượng, an toàn và tinh gọn)
# ------------------------------------------------------------------------------
FROM base AS production

ENV NODE_ENV=production

# Chỉ cài đặt dependencies cần thiết cho runtime production
COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

# Copy mã nguồn dự án
COPY . .

# Phân quyền cho user node bảo mật
RUN mkdir -p /app/uploads && chown -R node:node /app

USER node

EXPOSE 5000

# Chạy server với chế độ production
CMD ["npm", "start"]
