
import { initTRPC } from '@trpc/server';
import { createHTTPServer } from '@trpc/server/adapters/standalone';
import 'dotenv/config';
import cors from 'cors';
import superjson from 'superjson';
import { z } from 'zod';

// Import schemas
import { 
  createWalletInputSchema, 
  importWalletInputSchema,
  tokenDataInputSchema,
  buyTokenInputSchema,
  sellTokenInputSchema,
  createLimitOrderInputSchema,
  updateSettingsInputSchema
} from './schema';

// Import handlers
import { getDashboardData } from './handlers/get_dashboard_data';
import { createWallet } from './handlers/create_wallet';
import { importWallet } from './handlers/import_wallet';
import { getWallets } from './handlers/get_wallets';
import { setActiveWallet } from './handlers/set_active_wallet';
import { deleteWallet } from './handlers/delete_wallet';
import { getTokenData } from './handlers/get_token_data';
import { buyToken } from './handlers/buy_token';
import { getTokenHoldings } from './handlers/get_token_holdings';
import { sellToken } from './handlers/sell_token';
import { createLimitOrder } from './handlers/create_limit_order';
import { getLimitOrders } from './handlers/get_limit_orders';
import { cancelLimitOrder } from './handlers/cancel_limit_order';
import { getSettings } from './handlers/get_settings';
import { updateSettings } from './handlers/update_settings';
import { getTransactions } from './handlers/get_transactions';
import { updateWalletBalance } from './handlers/update_wallet_balance';

const t = initTRPC.create({
  transformer: superjson,
});

const publicProcedure = t.procedure;
const router = t.router;

const appRouter = router({
  // Health check
  healthcheck: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  // Dashboard
  getDashboardData: publicProcedure
    .query(() => getDashboardData()),

  // Wallet management
  createWallet: publicProcedure
    .input(createWalletInputSchema)
    .mutation(({ input }) => createWallet(input)),

  importWallet: publicProcedure
    .input(importWalletInputSchema)
    .mutation(({ input }) => importWallet(input)),

  getWallets: publicProcedure
    .query(() => getWallets()),

  setActiveWallet: publicProcedure
    .input(z.object({ walletId: z.number() }))
    .mutation(({ input }) => setActiveWallet(input.walletId)),

  deleteWallet: publicProcedure
    .input(z.object({ walletId: z.number() }))
    .mutation(({ input }) => deleteWallet(input.walletId)),

  updateWalletBalance: publicProcedure
    .input(z.object({ walletId: z.number() }))
    .mutation(({ input }) => updateWalletBalance(input.walletId)),

  // Token operations
  getTokenData: publicProcedure
    .input(tokenDataInputSchema)
    .query(({ input }) => getTokenData(input)),

  buyToken: publicProcedure
    .input(buyTokenInputSchema)
    .mutation(({ input }) => buyToken(input)),

  getTokenHoldings: publicProcedure
    .input(z.object({ walletId: z.number() }))
    .query(({ input }) => getTokenHoldings(input.walletId)),

  sellToken: publicProcedure
    .input(sellTokenInputSchema)
    .mutation(({ input }) => sellToken(input)),

  // Limit orders
  createLimitOrder: publicProcedure
    .input(createLimitOrderInputSchema)
    .mutation(({ input }) => createLimitOrder(input)),

  getLimitOrders: publicProcedure
    .input(z.object({ walletId: z.number() }))
    .query(({ input }) => getLimitOrders(input.walletId)),

  cancelLimitOrder: publicProcedure
    .input(z.object({ orderId: z.number() }))
    .mutation(({ input }) => cancelLimitOrder(input.orderId)),

  // Settings
  getSettings: publicProcedure
    .input(z.object({ walletId: z.number() }))
    .query(({ input }) => getSettings(input.walletId)),

  updateSettings: publicProcedure
    .input(updateSettingsInputSchema)
    .mutation(({ input }) => updateSettings(input)),

  // Transactions
  getTransactions: publicProcedure
    .input(z.object({ walletId: z.number() }))
    .query(({ input }) => getTransactions(input.walletId)),
});

export type AppRouter = typeof appRouter;

async function start() {
  const port = process.env['SERVER_PORT'] || 2022;
  const server = createHTTPServer({
    middleware: (req, res, next) => {
      cors()(req, res, next);
    },
    router: appRouter,
    createContext() {
      return {};
    },
  });
  server.listen(port);
  console.log(`TRPC server listening at port: ${port}`);
}

start();
