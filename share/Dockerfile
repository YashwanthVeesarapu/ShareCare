# Build the Angular app
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build:prod

# Production image: serve with Node.js
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app/dist ./dist
RUN npm install -g serve
ENV PORT=8000
EXPOSE 8000
CMD sh -c "serve -s dist/share/browser -l $PORT"