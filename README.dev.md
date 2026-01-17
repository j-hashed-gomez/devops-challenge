# Development Environment Setup

This document describes the local development environment for the Tech Challenge application.

## Prerequisites

- Docker Engine 20.10+
- Docker Compose V2

## Architecture

The development environment consists of two services:

1. **MongoDB 8.0.17**: Database service with MongoBleed (CVE-2025-14847) patch
2. **NestJS Application**: Backend API built with distroless containers

## Quick Start

### 1. Configure Environment Variables

Copy the example environment file and adjust values if needed:

```bash
cp .env.example .env
```

Default values:
- `MONGO_ROOT_USERNAME`: admin
- `MONGO_ROOT_PASSWORD`: changeme
- `PORT`: 3000

### 2. Start Services

Build and start all services:

```bash
docker compose up -d
```

### 3. Verify Services

Check service status:

```bash
docker compose ps
```

Test the application:

```bash
curl http://localhost:3000
```

Expected response:
```json
{"request":"[GET] /","user_agent":"curl/..."}
```

### 4. View Logs

Application logs:
```bash
docker compose logs -f app
```

MongoDB logs:
```bash
docker compose logs -f mongodb
```

### 5. Stop Services

```bash
docker compose down
```

To remove volumes as well:
```bash
docker compose down -v
```

## Container Details

### Application Container

- **Base Image**: gcr.io/distroless/nodejs20-debian12:nonroot
- **Size**: ~144MB (optimized with multi-stage build)
- **User**: nonroot (UID 65532)
- **Port**: 3000
- **Health Check**: HTTP GET on port 3000

Build process:
1. **Stage 1 (deps)**: Install production dependencies
2. **Stage 2 (builder)**: Install all dependencies and build TypeScript
3. **Stage 3 (runtime)**: Copy only necessary files to distroless image

### MongoDB Container

- **Image**: mongo:8.0.17
- **Port**: 27017
- **Network Compression**: Snappy (zlib disabled for defense in depth)
- **Health Check**: mongosh ping command
- **Initialization**: Automatic schema setup via init script

The database is initialized with sample visit data on first startup.

## Security Features

### Application
- Non-root user execution (UID 65532)
- Read-only root filesystem capability
- No shell or package manager in production image
- Resource limits (CPU: 1 core, Memory: 512MB)
- Security options: no-new-privileges

### MongoDB
- Authentication required
- Credentials managed via environment variables
- zlib compression disabled (using Snappy instead)
- Persistent volumes for data
- Health checks for startup validation

## Data Persistence

Data is persisted in Docker volumes:
- `mongodb_data`: Database files
- `mongodb_config`: MongoDB configuration

These volumes survive container restarts. Remove them with `docker compose down -v` only when you want to reset the database.

## Development Workflow

1. Make changes to source code
2. Rebuild the application:
   ```bash
   docker compose up -d --build app
   ```
3. Test changes
4. View logs for debugging

## Troubleshooting

### Application won't start

Check logs:
```bash
docker compose logs app
```

Common issues:
- MongoDB not ready: Wait for MongoDB health check to pass
- Port already in use: Change PORT in .env file

### MongoDB initialization failed

Check MongoDB logs:
```bash
docker compose logs mongodb
```

Verify initialization script:
```bash
docker exec tech-challenge-mongodb ls /docker-entrypoint-initdb.d/
```

### Connection refused

Ensure all services are healthy:
```bash
docker compose ps
```

Both services should show "healthy" status.

## Resource Usage

Typical resource consumption:
- Application: ~100MB RAM, <5% CPU (idle)
- MongoDB: ~150MB RAM, <10% CPU (idle)

## Next Steps

After local development is working:
- Set up CI/CD pipeline (GitHub Actions)
- Create Kubernetes manifests
- Configure infrastructure as code (Terraform)
- Implement monitoring and observability
