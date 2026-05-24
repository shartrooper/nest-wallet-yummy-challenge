# Nest Wallet Service

A robust, auditable, and high-performance wallet service built with NestJS and PostgreSQL.

## 🚀 Live Demo & Documentation
- **API Documentation (Swagger):** `[Your Cloud URL]/docs` (e.g., `https://nest-wallet.up.railway.app/docs`)
- **Security Key:** `example-evaluator-secret-123` (Use the **Authorize** button in Swagger)

## Features
- **Deterministic Concurrency**: Prevents deadlocks using ordered pessimistic locking (lower UUID first).
- **Financial Integrity**: Ledger-based accounting with PostgreSQL `DECIMAL(20, 2)` types and `CHECK` constraints.
- **Two-Tier Idempotency**: Unique ledger keys + Response caching interceptor for 100% reliable retries.
- **Security**: Global API Key protection with public health checks.
- **Seeding**: Protected `/system/seed` endpoint to instantly prepare demo accounts for evaluation.

## Getting Started

### Prerequisites
- Node.js (v24+)
- PostgreSQL

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure:
   ```env
   API_KEY=example-evaluator-secret-123
   ```

### Running the Application (Single Command Docker)
To deploy the entire stack (Database + Application) in a clean machine:
```bash
docker-compose up --build
```
The API will be available at `http://localhost:3000/docs`.

### Running Locally (Native)
1. Start the database: `docker-compose up db -d`
2. Start the application:
   ```bash
   npm run start:dev
   ```
3. Visit `http://localhost:3000/docs`.

### Testing
- **Unit Tests:** `npm test`
- **Reliability & Security E2E:** `npm run test:e2e` (Verifies concurrency, idempotency, and auth).
- **Test inside Docker:** `docker-compose run --rm app npm run test:e2e`

## API Endpoints

### System
- `GET /system/health`: (Public) Check service status.
- `POST /system/seed`: (Locked) Seed demo accounts with initial balances. (Idempotent: can be run multiple times to reset balances of demo accounts).
- `POST /system/reset`: (Locked) Wipe all data (Movements, Accounts, Idempotency) to start from a completely clean state.

### Wallet (All require `x-api-key`)
- `POST /wallet/account`: Create a new account.
- `GET /wallet/balance/:id`: Check balance.
- `GET /wallet/history/:id`: View transaction ledger.
- `POST /wallet/deposit` / `POST /wallet/withdraw` / `POST /wallet/transfer`.

## Documentation
- [Diagram & Specs](diagrama-arquitectura.md)