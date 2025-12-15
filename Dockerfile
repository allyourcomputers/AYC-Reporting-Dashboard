# Use official Node.js LTS image
FROM node:20-alpine

# Install su-exec for running app as non-root user
RUN apk add --no-cache su-exec

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application files
COPY . .

# Copy cron configuration and scripts
COPY crontab /etc/crontabs/root
COPY sync-cron.sh /app/sync-cron.sh
COPY docker-entrypoint.sh /app/docker-entrypoint.sh

# Create a non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001

# Make scripts executable
RUN chmod +x /app/sync-cron.sh /app/docker-entrypoint.sh

# Create log directory and set permissions
RUN mkdir -p /var/log && \
    touch /var/log/sync.log && \
    chown -R nodejs:nodejs /var/log/sync.log

# Change ownership of the app directory
RUN chown -R nodejs:nodejs /app

# Expose port (can be overridden with PORT env variable)
EXPOSE 3100

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3100/api/config', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Use entrypoint script to start both cron and the app
ENTRYPOINT ["/app/docker-entrypoint.sh"]
