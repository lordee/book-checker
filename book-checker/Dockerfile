# https://developers.home-assistant.io/docs/apps/configuration#app-dockerfile
ARG BUILD_FROM=ghcr.io/home-assistant/base:latest

# Stage 1: Build Frontend
FROM node:22-slim AS frontend-build
WORKDIR /app
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Build Backend
FROM node:22-slim AS backend-build
WORKDIR /app
COPY backend/package*.json ./
RUN npm install
COPY backend/ ./
RUN npm run build

# Stage 3: Final Image
FROM ${BUILD_FROM}

# Execute during the build of the image
ARG TEMPIO_VERSION=2021.09.0
ARG TARGETARCH="amd64"
RUN \
    apk add --no-cache nodejs npm \
    && if [ -z "${TARGETARCH}" ]; then \
        echo "TARGETARCH is not set, please use Docker BuildKit for the build." && exit 1; \
    fi \
    && case "${TARGETARCH}" in \
        amd64) tempio_arch="amd64" ;; \
        arm64) tempio_arch="aarch64" ;; \
        *) echo "Unsupported TARGETARCH: ${TARGETARCH}" && exit 1 ;; \
    esac \
    && curl -sSLf -o /usr/bin/tempio \
        "https://github.com/home-assistant/tempio/releases/download/${TEMPIO_VERSION}/tempio_${tempio_arch}"

# Set shell
SHELL ["/bin/bash", "-o", "pipefail", "-c"]

# Install necessary packages
RUN apk add --no-cache nodejs npm

WORKDIR /app

# Copy backend built files
COPY --from=backend-build /app/dist ./dist
COPY --from=backend-build /app/package*.json ./
RUN npm install --only=production

# Copy frontend built files to be served by backend
COPY --from=frontend-build /app/dist ./frontend-dist

# Copy backend source for any runtime needs (though dist should be enough)
# In this case, we need the package.json and node_modules we just installed

# Environment variables
ENV PORT=5173
ENV PROJECT_ROOT=/data

# Expose the port
EXPOSE 5173

LABEL \
    org.opencontainers.image.title="Home Assistant App: Book Checker" \
    org.opencontainers.image.description="Book checker app for Home Assistant." \
    org.opencontainers.image.source="https://github.com/lordee/book-checker" \
    org.opencontainers.image.licenses="Apache License 2.0"

# Start the backend
CMD [ "node", "dist/index.js" ]
