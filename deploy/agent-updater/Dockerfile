FROM docker:24.0.7-cli

RUN apk add --no-cache nodejs npm docker-compose

WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

COPY src ./src

CMD ["npm", "start"]
