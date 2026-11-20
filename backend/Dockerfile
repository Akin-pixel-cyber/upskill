FROM node:20-alpine
WORKDIR /app
COPY backend/package.json ./
RUN npm install --omit=dev --no-audit --no-fund
COPY backend/src ./src
RUN mkdir -p /data/uploads/avatars /data/uploads/evidence && chown -R node:node /data /app
USER node
ENV NODE_ENV=production UPLOAD_DIR=/data/uploads
EXPOSE 4000
HEALTHCHECK --interval=15s --timeout=5s --retries=6 --start-period=20s CMD wget -qO- http://127.0.0.1:4000/api/health || exit 1
CMD ["node", "src/index.js"]
