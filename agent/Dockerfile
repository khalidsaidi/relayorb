FROM node:20-slim

WORKDIR /app

COPY agent/package.json ./
RUN npm install --omit=dev

COPY agent/src ./src
COPY adapters ./adapters

CMD ["node", "src/index.js"]
