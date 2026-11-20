
FROM php:8.4-apache

# Install SQLite development library and PHP PDO SQLite extension
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev \
    && docker-php-ext-install pdo_sqlite \
    && rm -rf /var/lib/apt/lists/*

# Enable Apache rewrite
RUN a2enmod rewrite

# Set the public folder as document root
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN sed -ri 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/*.conf \
    && sed -ri 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf

# Configure API routing
RUN printf '<Directory /var/www/html/public>\n\
    Options FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>\n' >> /etc/apache2/apache2.conf

WORKDIR /var/www/html

COPY . .

# Allow Apache to write to SQLite storage
RUN mkdir -p /var/www/html/storage \
    && chown -R www-data:www-data /var/www/html/storage

# Render/Railway port
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "sed -i \"s/Listen 80/Listen ${PORT}/\" /etc/apache2/ports.conf && sed -i \"s/<VirtualHost \\\\*:80>/<VirtualHost *:${PORT}>/\" /etc/apache2/sites-available/000-default.conf && apache2-foreground"]
