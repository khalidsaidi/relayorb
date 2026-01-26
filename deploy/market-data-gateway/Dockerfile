FROM node:20-slim

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --omit=dev

COPY shared /shared
COPY src ./src

CMD ["node", "src/index.js"]
