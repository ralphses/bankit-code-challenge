import { Injectable } from '@nestjs/common';
import { Prisma, TransactionStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { createHash } from 'node:crypto';
import { ulid } from 'ulid';
import { DomainError } from '../common/errors/domain-error';
import { PrismaService } from '../prisma/prisma.service';
import { CreateTransferDto, TransferCreatedResponse, TransferLookupResponse } from './transfer.dto';

type Outcome = {
  ok: boolean;
  status: number;
  reference: string;
  response?: TransferCreatedResponse;
  error?: { code: string; message: string };
};

type LockedAccount = { id: string; balance_minor: bigint; currency: string };

const toMinor = (value: number): bigint => {
  try {
    const decimal = new Decimal(String(value));
    if (!decimal.isFinite() || decimal.lte(0) || decimal.decimalPlaces() > 2) throw new Error();
    return BigInt(decimal.times(100).toFixed(0));
  } catch {
    throw new DomainError(400, 'INVALID_REQUEST', 'Amount must be greater than zero and have at most two decimal places');
  }
};

const toMajor = (minor: bigint): number => Number(new Decimal(minor.toString()).dividedBy(100).toString());

@Injectable()
export class TransfersService {
  constructor(private readonly prisma: PrismaService) {}

  async create(request: CreateTransferDto, idempotencyKey: string | undefined): Promise<{ result: TransferCreatedResponse; status: number }> {
    if (!idempotencyKey?.trim() || idempotencyKey.length > 255) throw new DomainError(400, 'INVALID_REQUEST', 'A valid Idempotency-Key header is required');
    const senderId = this.parseUuid(request.senderAccountId);
    const recipientId = this.parseUuid(request.recipientAccountId);
    const amountMinor = toMinor(request.amount);
    const hash = createHash('sha256').update(`${senderId}|${recipientId}|${new Decimal(String(request.amount)).toFixed(2)}`).digest('hex');
    const outcome = await this.prisma.$transaction(async (tx) => {
      const claim = await tx.idempotencyKey.createMany({ data: { key: idempotencyKey, requestHash: hash }, skipDuplicates: true });
      if (claim.count === 0) {
        const existing = await tx.idempotencyKey.findUnique({ where: { key: idempotencyKey } });
        if (!existing) throw new Error('Idempotency record disappeared');
        if (existing.requestHash !== hash) return this.failure(existing.reference ?? '', 409, 'IDEMPOTENCY_KEY_REUSED', 'The idempotency key was already used for a different transfer');
        const stored = existing.responseJson as unknown as Outcome | null;
        if (!stored) throw new Error('Idempotency response is incomplete');
        return stored.ok ? { ...stored, status: 200 } : stored;
      }

      const reference = `TRX-${ulid()}`;
      if (senderId === recipientId) return this.completeFailure(tx, idempotencyKey, reference, 409, 'INVALID_REQUEST', 'Sender and recipient accounts must be different', TransactionStatus.FAILED_INVALID_REQUEST);
      const ids = [senderId, recipientId].sort();
      const accounts = await tx.$queryRaw<LockedAccount[]>(Prisma.sql`SELECT id::text, balance_minor, currency FROM accounts WHERE id IN (${Prisma.join(ids.map((id) => Prisma.sql`${id}::uuid`))}) ORDER BY id FOR UPDATE`);
      const sender = accounts.find((account) => account.id === senderId);
      const recipient = accounts.find((account) => account.id === recipientId);
      if (!sender || !recipient) return this.completeFailure(tx, idempotencyKey, reference, 404, 'ACCOUNT_NOT_FOUND', 'One or both accounts do not exist', TransactionStatus.FAILED_ACCOUNT_NOT_FOUND);
      if (sender.currency !== recipient.currency) {
        await tx.transaction.create({ data: { reference, senderAccountId: senderId, recipientAccountId: recipientId, amountMinor, currency: sender.currency, status: TransactionStatus.FAILED_CURRENCY_MISMATCH } });
        return this.completeFailure(tx, idempotencyKey, reference, 409, 'CURRENCY_MISMATCH', 'Sender and recipient currencies must match', TransactionStatus.FAILED_CURRENCY_MISMATCH);
      }
      if (sender.balance_minor < amountMinor) {
        await tx.transaction.create({ data: { reference, senderAccountId: senderId, recipientAccountId: recipientId, amountMinor, currency: sender.currency, status: TransactionStatus.FAILED_INSUFFICIENT_FUNDS } });
        return this.completeFailure(tx, idempotencyKey, reference, 422, 'INSUFFICIENT_FUNDS', 'Insufficient account balance', TransactionStatus.FAILED_INSUFFICIENT_FUNDS);
      }
      const debit = await tx.$executeRaw(Prisma.sql`UPDATE accounts SET balance_minor = balance_minor - ${amountMinor} WHERE id = ${senderId}::uuid AND balance_minor >= ${amountMinor}`);
      if (debit !== 1) throw new Error('Sender debit did not affect exactly one row');
      const credit = await tx.$executeRaw(Prisma.sql`UPDATE accounts SET balance_minor = balance_minor + ${amountMinor} WHERE id = ${recipientId}::uuid`);
      if (credit !== 1) throw new Error('Recipient credit did not affect exactly one row');
      const transaction = await tx.transaction.create({ data: { reference, senderAccountId: senderId, recipientAccountId: recipientId, amountMinor, currency: sender.currency, status: TransactionStatus.SUCCESS } });
      const response: TransferCreatedResponse = { success: true, reference: transaction.reference, status: transaction.status };
      const outcome: Outcome = { ok: true, status: 201, reference, response };
      await tx.idempotencyKey.update({ where: { key: idempotencyKey }, data: { reference, httpStatus: 201, responseJson: outcome as unknown as Prisma.InputJsonValue, completed: true } });
      return outcome;
    });
    if (!outcome.ok) throw new DomainError(outcome.status, outcome.error?.code ?? 'TRANSFER_FAILED', outcome.error?.message ?? 'The transfer could not be completed', outcome.reference);
    return { result: outcome.response!, status: outcome.status };
  }

  async get(reference: string): Promise<TransferLookupResponse> {
    const transaction = await this.prisma.transaction.findUnique({ where: { reference } });
    if (!transaction) throw new DomainError(404, 'NOT_FOUND', 'Transfer not found');
    return { reference: transaction.reference, senderAccountId: transaction.senderAccountId ?? '', recipientAccountId: transaction.recipientAccountId ?? '', amount: toMajor(transaction.amountMinor), currency: transaction.currency, status: transaction.status, createdAt: transaction.createdAt };
  }

  private async completeFailure(tx: Prisma.TransactionClient, key: string, reference: string, status: number, code: string, message: string, transferStatus: TransactionStatus): Promise<Outcome> {
    if (transferStatus === TransactionStatus.FAILED_INVALID_REQUEST || transferStatus === TransactionStatus.FAILED_ACCOUNT_NOT_FOUND) {
      await tx.idempotencyKey.update({ where: { key }, data: { reference, httpStatus: status, responseJson: this.failure(reference, status, code, message) as unknown as Prisma.InputJsonValue, completed: true } });
    } else {
      await tx.idempotencyKey.update({ where: { key }, data: { reference, httpStatus: status, responseJson: this.failure(reference, status, code, message) as unknown as Prisma.InputJsonValue, completed: true } });
    }
    return this.failure(reference, status, code, message);
  }

  private failure(reference: string, status: number, code: string, message: string): Outcome {
    return { ok: false, status, reference, error: { code, message } };
  }

  private parseUuid(value: string): string {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) throw new DomainError(400, 'INVALID_REQUEST', 'Account IDs must be valid UUIDs');
    return value;
  }
}
