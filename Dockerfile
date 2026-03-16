FROM node:18-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY dist/ dist/

ENTRYPOINT ["node", "dist/cli.js", "mcp", "serve"]
