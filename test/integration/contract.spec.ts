import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../../src/app.module';
import { GlobalExceptionFilter } from '../../src/common/filters/global-exception.filter';

jest.setTimeout(60000);

describe('Bankit API contract', () => {
  let app: INestApplication;
  let postgres: StartedPostgreSqlContainer;
  let prisma: PrismaClient;
  const senderAccountId = '4460e9d1-c459-4752-9cc4-cf6a6ecb9cab';
  const recipientAccountId = '4d86d928-f3b7-4544-a96d-a14cd4c4d602';
  let reference: string;

  beforeAll(async () => {
    postgres = await new PostgreSqlContainer('postgres:16-alpine').start();
    process.env.DATABASE_URL = postgres.getConnectionUri();
    process.env.BANKIT_API_USERNAME = 'test-client';
    process.env.BANKIT_API_PASSWORD = 'test-password';
    execFileSync('npx', ['prisma', 'migrate', 'deploy'], { stdio: 'inherit', env: process.env });
    prisma = new PrismaClient();
    await prisma.user.createMany({ data: [
      { id: '00000000-0000-0000-0000-000000000001', name: 'Customer A', email: 'customer.a@bankit.test' },
      { id: '00000000-0000-0000-0000-000000000002', name: 'Customer B', email: 'customer.b@bankit.test' }
    ] });
    await prisma.account.createMany({ data: [
      { id: senderAccountId, userId: '00000000-0000-0000-0000-000000000001', accountNumber: '0123456789', balanceMinor: 10000000n, currency: 'NGN' },
      { id: recipientAccountId, userId: '00000000-0000-0000-0000-000000000002', accountNumber: '0123456790', balanceMinor: 5000000n, currency: 'NGN' }
    ] });
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new GlobalExceptionFilter());
    await app.init();
  });

  afterAll(async () => { await app?.close(); await prisma?.$disconnect(); await postgres?.stop(); });

  it('requires authentication', async () => {
    await request(app.getHttpServer()).get(`/accounts/${senderAccountId}/balance`).expect(401);
  });

  it('creates a transfer and returns the exact flat response', async () => {
    const response = await request(app.getHttpServer()).post('/transfers')
      .auth('test-client', 'test-password')
      .set('Idempotency-Key', 'integration-success-1')
      .send({ senderAccountId, recipientAccountId, amount: 20000 })
      .expect(201);
    expect(response.body.success).toBe(true);
    expect(response.body.status).toBe('SUCCESS');
    expect(response.body.reference).toMatch(/^TRX-/);
    expect(Object.keys(response.body).sort()).toEqual(['reference', 'status', 'success']);
    reference = response.body.reference as string;
  });

  it('replays the original result without debiting twice', async () => {
    const response = await request(app.getHttpServer()).post('/transfers')
      .auth('test-client', 'test-password')
      .set('Idempotency-Key', 'integration-success-1')
      .send({ senderAccountId, recipientAccountId, amount: 20000 })
      .expect(200);
    expect(response.body).toEqual({ success: true, reference, status: 'SUCCESS' });
    const accounts = await prisma.account.findMany({ where: { id: { in: [senderAccountId, recipientAccountId] } }, orderBy: { accountNumber: 'asc' } });
    expect(accounts.map((account) => account.balanceMinor)).toEqual([8000000n, 7000000n]);
  });

  it('returns the lookup shape and wrapped balance', async () => {
    const lookup = await request(app.getHttpServer()).get(`/transfers/${reference}`).auth('test-client', 'test-password').expect(200);
    expect(lookup.body.senderAccountId).toBe(senderAccountId);
    expect(lookup.body.recipientAccountId).toBe(recipientAccountId);
    expect(lookup.body.amount).toBe(20000);
    const balance = await request(app.getHttpServer()).get(`/accounts/${senderAccountId}/balance`).auth('test-client', 'test-password').expect(200);
    expect(balance.body).toEqual({ success: true, data: { accountId: senderAccountId, accountNumber: '0123456789', balance: 80000, currency: 'NGN' }, error: null });
  });

  it('returns structured insufficient-funds errors', async () => {
    const response = await request(app.getHttpServer()).post('/transfers')
      .auth('test-client', 'test-password')
      .set('Idempotency-Key', 'integration-insufficient-1')
      .send({ senderAccountId, recipientAccountId, amount: 999999 })
      .expect(422);
    expect(response.body).toEqual({ success: false, error: { code: 'INSUFFICIENT_FUNDS', message: 'Insufficient account balance' } });
  });

  it('rejects reuse of an idempotency key with a different payload', async () => {
    const response = await request(app.getHttpServer()).post('/transfers')
      .auth('test-client', 'test-password')
      .set('Idempotency-Key', 'integration-success-1')
      .send({ senderAccountId, recipientAccountId, amount: 21000 })
      .expect(409);
    expect(response.body).toEqual({ success: false, error: { code: 'IDEMPOTENCY_KEY_REUSED', message: 'The idempotency key was already used for a different transfer' } });
  });

  it('prevents concurrent requests from spending the same balance twice', async () => {
    await prisma.account.update({ where: { id: senderAccountId }, data: { balanceMinor: 10000000n } });
    await prisma.account.update({ where: { id: recipientAccountId }, data: { balanceMinor: 0n } });
    const requests = ['concurrent-a', 'concurrent-b'].map((key) => request(app.getHttpServer()).post('/transfers')
      .auth('test-client', 'test-password')
      .set('Idempotency-Key', key)
      .send({ senderAccountId, recipientAccountId, amount: 90000 }));
    const responses = await Promise.all(requests);
    expect(responses.map((response) => response.status).sort()).toEqual([201, 422]);
    const sender = await prisma.account.findUniqueOrThrow({ where: { id: senderAccountId } });
    expect(sender.balanceMinor).toBe(1000000n);
  });
});
