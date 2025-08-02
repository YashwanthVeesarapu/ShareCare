# Use official Python image as base
FROM python:3.12-slim

# Set working directory
WORKDIR /app

# Install dependencies
COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

ENV PORT=8000
# Expose port (change if your app uses a different port)
EXPOSE ${PORT}

# Set environment variables (optional)
# ENV PYTHONUNBUFFERED=1

# Run the application
CMD ["python", "main.py"]
