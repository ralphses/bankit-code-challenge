import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import Decimal from 'decimal.js';
import { randomUUID } from 'node:crypto';

const prisma = new PrismaClient();
const minor = (major: string): bigint => BigInt(new Decimal(major).times(100).toFixed(0));
const optional = (value: string | undefined): string | undefined => value?.trim() || undefined;

async function seedCustomer(input: {
  accountId?: string; userId?: string; name: string; email: string; accountNumber: string; balance: string; currency: string;
}): Promise<void> {
  const user = await prisma.user.upsert({
    where: { email: input.email },
    update: { name: input.name },
    create: { id: input.userId ?? randomUUID(), name: input.name, email: input.email }
  });
  await prisma.account.upsert({
    where: { accountNumber: input.accountNumber },
    update: { userId: user.id, balanceMinor: minor(input.balance), currency: input.currency },
    create: { id: input.accountId ?? randomUUID(), userId: user.id, accountNumber: input.accountNumber, balanceMinor: minor(input.balance), currency: input.currency }
  });
}

async function main(): Promise<void> {
  const currency = process.env.BANKIT_CUSTOMER_CURRENCY ?? 'NGN';
  await seedCustomer({
    accountId: optional(process.env.BANKIT_CUSTOMER_A_ACCOUNT_ID),
    userId: optional(process.env.BANKIT_CUSTOMER_A_USER_ID),
    name: process.env.BANKIT_CUSTOMER_A_NAME ?? 'Customer A',
    email: process.env.BANKIT_CUSTOMER_A_EMAIL ?? 'customer.a@bankit.test',
    accountNumber: process.env.BANKIT_CUSTOMER_A_ACCOUNT_NUMBER ?? '0123456789',
    balance: process.env.BANKIT_CUSTOMER_A_BALANCE ?? '100000', currency
  });
  await seedCustomer({
    accountId: optional(process.env.BANKIT_CUSTOMER_B_ACCOUNT_ID),
    userId: optional(process.env.BANKIT_CUSTOMER_B_USER_ID),
    name: process.env.BANKIT_CUSTOMER_B_NAME ?? 'Customer B',
    email: process.env.BANKIT_CUSTOMER_B_EMAIL ?? 'customer.b@bankit.test',
    accountNumber: process.env.BANKIT_CUSTOMER_B_ACCOUNT_NUMBER ?? '0123456790',
    balance: process.env.BANKIT_CUSTOMER_B_BALANCE ?? '50000', currency
  });
  const accounts = await prisma.account.findMany({ where: { accountNumber: { in: ['0123456789', '0123456790'] } }, orderBy: { accountNumber: 'asc' } });
  for (const account of accounts) console.log(`${account.accountNumber}: ${account.id} (${account.balanceMinor.toString()} minor units, ${account.currency})`);
}

main().catch((error: unknown) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
