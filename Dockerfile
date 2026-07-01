# ── Stage 1 : Build frontend ──────────────────────────────────────
FROM node:20-alpine AS frontend-build

WORKDIR /app
COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

# VITE_API_BASE_URL vide = URLs relatives (/api/...) → même origine
ARG VITE_API_BASE_URL=""
ENV VITE_API_BASE_URL=${VITE_API_BASE_URL}
RUN npm run build

# ── Stage 2 : PHP 8.1 + Apache ────────────────────────────────────
FROM php:8.1-apache # nosonar

# Extensions PHP requises (pdo_mysql est bundlé dans l'image officielle)
RUN docker-php-ext-install pdo pdo_mysql \
    && a2enmod rewrite

# Composer depuis l'image officielle
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Document root = backend PHP
WORKDIR /var/www/html

# Dépendances Composer — skip autoloader (classmap impossible sans le code)
COPY backend/composer.json backend/composer.lock ./
RUN composer install --no-dev --no-interaction --prefer-dist --no-autoloader --no-scripts

# Code backend + génération du classmap final
COPY backend/ ./
RUN composer dump-autoload --optimize --no-dev

# Build frontend → sous-répertoire dist/
COPY --from=frontend-build /app/dist/ ./dist/

# .htaccess Docker (routing SPA + API)
COPY docker/.htaccess ./.htaccess

# Configuration Apache
COPY docker/apache.conf /etc/apache2/sites-available/000-default.conf

EXPOSE 80
CMD ["apache2-foreground"]
