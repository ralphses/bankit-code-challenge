export default () => ({
  port: Number(process.env.PORT ?? 8080),
  nodeEnv: process.env.NODE_ENV ?? 'local',
  swaggerEnabled: process.env.SWAGGER_ENABLED !== 'false',
  auth: {
    username: process.env.BANKIT_API_USERNAME ?? '',
    password: process.env.BANKIT_API_PASSWORD ?? ''
  },
  seed: {
    customerA: {
      accountId: process.env.BANKIT_CUSTOMER_A_ACCOUNT_ID,
      userId: process.env.BANKIT_CUSTOMER_A_USER_ID,
      name: process.env.BANKIT_CUSTOMER_A_NAME ?? 'Customer A',
      email: process.env.BANKIT_CUSTOMER_A_EMAIL ?? 'customer.a@bankit.test',
      accountNumber: process.env.BANKIT_CUSTOMER_A_ACCOUNT_NUMBER ?? '0123456789',
      balance: process.env.BANKIT_CUSTOMER_A_BALANCE ?? '100000'
    },
    customerB: {
      accountId: process.env.BANKIT_CUSTOMER_B_ACCOUNT_ID,
      userId: process.env.BANKIT_CUSTOMER_B_USER_ID,
      name: process.env.BANKIT_CUSTOMER_B_NAME ?? 'Customer B',
      email: process.env.BANKIT_CUSTOMER_B_EMAIL ?? 'customer.b@bankit.test',
      accountNumber: process.env.BANKIT_CUSTOMER_B_ACCOUNT_NUMBER ?? '0123456790',
      balance: process.env.BANKIT_CUSTOMER_B_BALANCE ?? '50000'
    },
    currency: process.env.BANKIT_CUSTOMER_CURRENCY ?? 'NGN'
  }
});
