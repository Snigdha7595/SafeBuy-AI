# One container serves the API and the built React app (used for Render).
FROM node:20-slim AS web
WORKDIR /web
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim
WORKDIR /app
COPY backend/requirements.txt backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt
COPY backend/ backend/
COPY data/ data/
COPY --from=web /web/dist frontend_dist
ENV FRONTEND_DIST=/app/frontend_dist SAFEBUY_DB=/tmp/safebuy.db PYTHONUNBUFFERED=1
WORKDIR /app/backend
# --proxy-headers so rate limiting sees each visitor's real IP behind Render's proxy
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
