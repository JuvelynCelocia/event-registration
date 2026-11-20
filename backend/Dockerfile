
FROM php:8.4-cli

# Install SQLite and required PHP extensions
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libsqlite3-dev \
        libonig-dev \
    && docker-php-ext-install pdo_sqlite mbstring \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

# Copy backend files
COPY . .

# Prepare persistent SQLite storage
RUN mkdir -p /var/www/html/storage

# Railway port
ENV PORT=8080
EXPOSE 8080

# Start PHP web server with API router
CMD ["sh", "-c", "exec php -S 0.0.0.0:${PORT:-8080} -t /var/www/html/public /var/www/html/public/index.php"]
