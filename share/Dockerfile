# Build the Angular app
FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

# Production image: serve with Node.js
FROM node:20-alpine
WORKDIR /app
COPY --from=build /app /app
ENV PORT=8000
EXPOSE ${PORT}
CMD sh -c "npx ng serve --port $PORT --host 0.0.0.0"