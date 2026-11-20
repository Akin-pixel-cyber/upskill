FROM node:20-alpine AS build
WORKDIR /app
COPY frontend/package.json ./
RUN npm install --no-audit --no-fund
COPY frontend/ ./
RUN npm run build

FROM caddy:2-alpine
COPY proxy/Caddyfile /etc/caddy/Caddyfile
COPY --from=build /app/dist /srv
