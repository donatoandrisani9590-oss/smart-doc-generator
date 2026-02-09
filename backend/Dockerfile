FROM python:3.11-slim

# Install system dependencies
# libreoffice-writer-nogui is needed for headless PDF conversion
# openjdk-17-jre is often a dependency for LibreOffice or similar tools, included just in case
# netcat-openbsd for wait-for-it scripts if needed
RUN apt-get update && apt-get install -y \
    libreoffice-writer-nogui \
    libreoffice-java-common \
    default-jre \
    netcat-openbsd \
    fonts-liberation \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Set environment variables
ENV PYTHONPATH=/app
ENV PYTHONUNBUFFERED=1

# Expose port
EXPOSE 8000

# Start command: ensure DB schema is up to date, then start the app
CMD ["sh", "-c", "python scripts/ensure_schema.py && uvicorn app.main:app --host 0.0.0.0 --port 8000"]
