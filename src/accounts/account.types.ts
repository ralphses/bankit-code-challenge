export type AccountBalanceResponse = {
  accountId: string;
  accountNumber: string;
  balance: number;
  currency: string;
};

export type TransferHistoryItem = {
  reference: string;
  senderAccountId: string;
  recipientAccountId: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
};

export type PageResponse<T> = {
  items: T[];
  page: number;
  limit: number;
  totalElements: number;
  totalPages: number;
};
