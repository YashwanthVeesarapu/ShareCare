# Build the Angular app
FROM node:20-alpine AS ui
WORKDIR /app
COPY share/package.json share/package-lock.json ./
RUN npm ci
COPY share/ .
RUN npm run build:prod


# Use official Python image as base
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY proxy/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY proxy/ .

# Copy Angular dist into /app/static
# If Angular outputs /ui/dist/<project>, update the path accordingly
COPY --from=ui /app/dist/share/browser /app/static

ENV PORT=8000
# Expose port (change if your app uses a different port)
EXPOSE ${PORT}

# Set environment variables (optional)
# ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python", "main.py"]
