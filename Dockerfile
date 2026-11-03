# Production Dockerfile for Form Training TDS with Antigravity Support
# Using Debian Bookworm slim for glibc binary compatibility with host-mounted agy CLI
FROM node:20-bookworm-slim

# Install ca-certificates and curl for healthchecks and secure external communication
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package manifest
COPY package.json ./

# Copy Node.js application server
COPY server.js ./

# Copy core HTML files and previews
COPY index.html ./
COPY training_internal_plan.html ./
COPY preview-learning-passport.html ./
COPY preview-learning-wall.html ./
COPY preview-performance-review.html ./

# Copy static assets and application modules
COPY css/ ./css/
COPY js/ ./js/
COPY approval/ ./approval/
COPY favicon/ ./favicon/
COPY assets/ ./assets/

# Copy reference data templates
COPY template_config_approvers.csv ./
COPY template_peserta_training.csv ./
COPY template_training_submissions.csv ./
COPY template_training_submissions.xlsx ./

# Set environment variables
ENV NODE_ENV=production \
    PORT=3000

# Expose default application port
EXPOSE 3000

# Health check against server health endpoint
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Start server
CMD ["node", "server.js"]
