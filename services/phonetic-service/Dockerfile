FROM node:22-alpine

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

ENV PORT=3010
EXPOSE 3010

CMD ["node", "dist/index.js"]
