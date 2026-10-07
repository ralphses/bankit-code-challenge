import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { DomainError } from '../common/errors/domain-error';
import { AccountBalanceResponse, PageResponse, TransferHistoryItem } from './account.types';

const toMajor = (minor: bigint): number => Number(minor) / 100;

@Injectable()
export class AccountsService {
  constructor(private readonly prisma: PrismaService) {}

  async balance(accountId: string): Promise<AccountBalanceResponse> {
    this.validateUuid(accountId);
    const account = await this.prisma.account.findUnique({ where: { id: accountId } });

    if (!account) {
        throw new DomainError(404, 'ACCOUNT_NOT_FOUND', `Account not found: ${accountId}`);
    }

    return { accountId: account.id, accountNumber: account.accountNumber, balance: toMajor(account.balanceMinor), currency: account.currency };
  }

  async history(accountId: string, page: number, limit: number): Promise<PageResponse<TransferHistoryItem>> {
    this.validateUuid(accountId);
    if (page < 1) {
        throw new DomainError(400, 'INVALID_PAGE', 'Page must be greater than or equal to 1');
    }
    if (limit < 1 || limit > 100) {
        throw new DomainError(400, 'INVALID_LIMIT', 'Limit must be between 1 and 100');
    }
    const account = await this.prisma.account.findUnique({ where: { id: accountId }, select: { id: true } });

    if (!account) {
        throw new DomainError(404, 'ACCOUNT_NOT_FOUND', `Account not found: ${accountId}`);
    }
    const where = { OR: [{ senderAccountId: accountId }, { recipientAccountId: accountId }] };

    const [totalElements, transactions] = await Promise.all([
      this.prisma.transaction.count({ where }),
      this.prisma.transaction.findMany({ where, orderBy: [{ createdAt: 'desc' }, { id: 'desc' }], skip: (page - 1) * limit, take: limit })
    ]);

    const items = transactions.map((item) => ({
      reference: item.reference,
      senderAccountId: item.senderAccountId ?? '',
      recipientAccountId: item.recipientAccountId ?? '',
      amount: toMajor(item.amountMinor),
      currency: item.currency,
      status: item.status,
      createdAt: item.createdAt
    }));

    return { items, page, limit, totalElements, totalPages: totalElements === 0 ? 0 : Math.ceil(totalElements / limit) };
  }

  private validateUuid(value: string): void {
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new DomainError(400, 'INVALID_REQUEST', 'Account IDs must be valid UUIDs');
    }
  }
}
