
FROM php:8.4-apache

# Install SQLite and PDO SQLite
RUN apt-get update \
    && apt-get install -y --no-install-recommends libsqlite3-dev \
    && docker-php-ext-install pdo_sqlite \
    && rm -rf /var/lib/apt/lists/*

# Ensure only one Apache MPM is enabled
RUN rm -f \
    /etc/apache2/mods-enabled/mpm_event.load \
    /etc/apache2/mods-enabled/mpm_event.conf \
    /etc/apache2/mods-enabled/mpm_worker.load \
    /etc/apache2/mods-enabled/mpm_worker.conf \
    && a2enmod mpm_prefork rewrite \
    && test "$(apache2ctl -M 2>/dev/null | grep -Ec 'mpm_(event|worker|prefork)_module')" -eq 1

# Set Apache document root to public
ENV APACHE_DOCUMENT_ROOT=/var/www/html/public

RUN sed -ri 's!/var/www/html!/var/www/html/public!g' /etc/apache2/sites-available/*.conf

# Configure access and rewrite
RUN printf '<Directory /var/www/html/public>\n\
    Options FollowSymLinks\n\
    AllowOverride All\n\
    Require all granted\n\
</Directory>\n' >> /etc/apache2/apache2.conf

WORKDIR /var/www/html

COPY . .

# Add API rewrite rules and forward Authorization header
RUN printf '%s\n' \
    'RewriteEngine On' \
    'RewriteRule .* - [E=HTTP_AUTHORIZATION:%{HTTP:Authorization}]' \
    'RewriteCond %{REQUEST_FILENAME} !-f' \
    'RewriteRule ^ index.php [QSA,L]' \
    > /var/www/html/public/.htaccess

# Allow Apache to write to SQLite storage
RUN mkdir -p /var/www/html/storage \
    && chown -R www-data:www-data /var/www/html/storage

# Railway port
ENV PORT=8080
EXPOSE 8080

CMD ["sh", "-c", "sed -i \"s/Listen 80/Listen ${PORT}/\" /etc/apache2/ports.conf && sed -i \"s/<VirtualHost \\\\*:80>/<VirtualHost *:${PORT}>/\" /etc/apache2/sites-available/000-default.conf && apache2-foreground"]
