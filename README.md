# SubTrack Backend

> Microservices Backend for Subscription & Billing Management Platform

![Stack](https://img.shields.io/badge/Stack-Express%20%7C%20MongoDB%20%7C%20Kafka%20%7C%20Redis-blue)
![License](https://img.shields.io/badge/License-MIT-green)

## Quick Start

```bash
# From root directory (SubTrack_System)
docker-compose -f docker-compose.dev.yml up -d
```

**Service URLs:**
| Service              | Port  | URL                       |
| -------------------- | ----- | ------------------------- |
| API Gateway          | 3000  | http://localhost:3000     |
| Auth Service         | 3001  | http://localhost:3001     |
| User Service         | 3002  | http://localhost:3002     |
| Billing Service      | 3003  | http://localhost:3003     |
| Notification Service | 3004  | http://localhost:3004     |
| MongoDB              | 29029 | mongodb://localhost:29029 |
| Redis                | 6379  | redis://localhost:6379    |
| Kafka UI             | 8080  | http://localhost:8080     |

## Architecture

```
┌──────────────┐     ┌─────────────────────────────────┐
│   Frontend   │────▶│         API Gateway             │
│  (React/TS)  │     │         :3000                   │
└──────────────┘     └──────────┬──────────────────────┘
                                │
         ┌──────────────────────┼──────────────────────┐
         ▼                      ▼                      ▼
┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Auth Service   │   │  User Service   │   │ Billing Service │
│     :3001       │   │     :3002       │   │     :3003       │
└────────┬────────┘   └────────┬────────┘   └────────┬────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               ▼
                        ┌─────────────┐
                        │    Kafka    │
                        │    :9092    │
                        └─────────────┘
```

## Services Overview

| Service                  | Port | Description                                               |
| ------------------------ | ---- | --------------------------------------------------------- |
| **API Gateway**          | 3000 | Request routing, authentication middleware, rate limiting |
| **Auth Service**         | 3001 | JWT authentication, registration, login, 2FA              |
| **User Service**         | 3002 | User profiles, organizations, team management             |
| **Billing Service**      | 3003 | Subscriptions, invoices, payment processing               |
| **Notification Service** | 3004 | Emails, webhooks, push notifications                      |

## Project Structure

```
SubTrack_backend/
├── services/
│   ├── api-gateway/          # Request routing & auth middleware
│   ├── auth-service/         # Authentication & authorization
│   ├── user-service/         # User & organization management
│   ├── billing-service/      # Subscription & payment handling
│   └── notification-service/ # Email & webhook delivery
├── shared/                   # Shared TypeScript types & utilities
├── docs/                     # API documentation
├── .env.example              # Environment template
└── package.json              # Root package configuration
```

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **Framework:** Express.js
- **Database:** MongoDB (per-service databases)
- **Messaging:** Apache Kafka
- **Cache:** Redis
- **Containerization:** Docker

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
JWT_SECRET=your-jwt-secret
JWT_REFRESH_SECRET=your-refresh-secret
STRIPE_SECRET_KEY=your-stripe-key
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=your-email
SMTP_PASS=your-password
```

## Development

```bash
# Install dependencies
npm install

# Start specific service locally
cd services/auth-service && npm run dev

# Run tests
npm test

# Build all services
npm run build
```

## API Documentation

- [API Overview](./docs/api-overview.md)
- [Auth Service](./docs/services/auth-service.md)
- [User Service](./docs/services/user-service.md)
- [Billing Service](./docs/services/billing-service.md)
- [Notification Service](./docs/services/notification-service.md)
- [Database Schema](./docs/database-schema.md)
- [Kafka Events](./docs/kafka-events.md)

## License

MIT
