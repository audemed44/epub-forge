FROM node:20-alpine

WORKDIR /app

COPY package.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY packages/core/package.json ./packages/core/package.json
RUN npm install

COPY . .

EXPOSE 3000
CMD ["npm", "start"]
