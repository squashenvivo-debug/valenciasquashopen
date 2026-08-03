FROM nginx:1.27-alpine

WORKDIR /usr/share/nginx/html

# Static site assets
COPY . /usr/share/nginx/html

# Nginx runtime config and env-driven config.js generation
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY docker/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh \
    && rm -rf /usr/share/nginx/html/.git /usr/share/nginx/html/.github /usr/share/nginx/html/.vscode /usr/share/nginx/html/supabase

EXPOSE 80

ENTRYPOINT ["/entrypoint.sh"]
