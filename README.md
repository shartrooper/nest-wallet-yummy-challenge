# Nest Wallet Service

A robust, auditable, and high-performance wallet service built with NestJS and PostgreSQL.

## Features
- **Deterministic Concurrency**: Prevents deadlocks using ordered pessimistic locking (lower UUID first).
- **Financial Integrity**: Ledger-based accounting with PostgreSQL `DECIMAL(20, 2)` types and `CHECK` constraints.
- **Idempotency**: Two-tier system featuring unique ledger keys and full response caching via interceptors.
- **Automated Schema**: Automatic application of SQL schema and connection health checks on startup.
- **Audit Trail**: Append-only movement ledger for full transaction traceability.

## Getting Started

### Prerequisites
- Node.js (v24+)
- PostgreSQL (Local installation or via Docker)

### Installation
1. Clone the repository.
2. Install dependencies:
   ```bash
   npm install
   ```
3. Copy `.env.example` to `.env` and configure your database credentials.

### Running the Application
1. Start the database:
   - **Using Docker (Optional):**
     ```bash
     docker-compose up -d db
     ```
   - **Using Native PostgreSQL:** Ensure your local PostgreSQL instance is running and matches the credentials in your `.env` file.

2. Start the application:
   ```bash
   npm run start:dev
   ```

### Testing
- Run all unit tests:
  ```bash
  npm test
  ```
- Run E2E tests (Reliability & Concurrency):
  ```bash
  npm run test:e2e
  ```

## API Endpoints

### Wallet
- `POST /wallet/account`: Create a new wallet account for a user.
- `GET /wallet/balance/:id`: Get the current balance of an account.
- `GET /wallet/history/:id`: Get the full transaction history (movements) for an account.
- `POST /wallet/deposit`: Deposit funds into an account.
- `POST /wallet/withdraw`: Withdraw funds from an account.
- `POST /wallet/transfer`: Transfer funds between two accounts.

*All POST requests support the optional `x-idempotency-key` header to ensure safe retries.*