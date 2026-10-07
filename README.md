# Bankit Transfer Service

This is a parallel rewrite of the Java/Spring Boot service in the parent directory. The Java project is intentionally unchanged.

## Run locally

Prerequisites: Node.js 22, npm, Docker, and PostgreSQL.

```bash
cp .env.example .env
npm ci
npx prisma migrate deploy
npm run db:seed
npm run start:dev
```

The seeded account IDs are configured through environment variables. The default values are:

```text
Customer A: 4460e9d1-c459-4752-9cc4-cf6a6ecb9cab
Customer B: 4d86d928-f3b7-4544-a96d-a14cd4c4d602
```

The seed command prints the final account IDs, account numbers, balances, and currencies. Account numbers are `0123456789` and `0123456790`. Money is accepted in major units and stored as integer minor units.

## Docker

```bash
docker compose up --build
```

The container waits for PostgreSQL, applies Prisma migrations, seeds the two configured customers, and starts the API on port `8080`.

Credentials default to `test-client` / `test-password` and can be changed through environment variables.

Swagger is available at `/swagger-ui.html` (also `/swagger`) and OpenAPI JSON at `/v3/api-docs` (also `/swagger-json`) when enabled.

## API examples

```bash
curl -u test-client:test-password -X POST http://localhost:8080/transfers \
  -H 'Content-Type: application/json' \
  -H 'Idempotency-Key: example-transfer-1' \
  -d '{"senderAccountId":"4460e9d1-c459-4752-9cc4-cf6a6ecb9cab","recipientAccountId":"4d86d928-f3b7-4544-a96d-a14cd4c4d602","amount":20000}'
```

```bash
curl -u test-client:test-password \
  'http://localhost:8080/accounts/4460e9d1-c459-4752-9cc4-cf6a6ecb9cab/transactions?page=1&limit=20'
```

## Tests

```bash
npm test
npm run test:integration
```

Integration tests use Testcontainers PostgreSQL and execute against real PostgreSQL transactions, constraints, and row locks.

The transfer path uses a Prisma interactive transaction and PostgreSQL `SELECT ... FOR UPDATE`, locking both accounts in deterministic UUID order. Idempotency keys are uniquely constrained and store the original result for safe retries.
