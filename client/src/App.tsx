
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { trpc } from '@/utils/trpc';
import type { 
  DashboardData, 
  Wallet, 
  Token, 
  LimitOrder, 
  Settings, 
  Transaction,
  CreateWalletInput,
  ImportWalletInput,
  BuyTokenInput,
  CreateLimitOrderInput,
  UpdateSettingsInput
} from '../../server/src/schema';

// Icons using Unicode symbols for better mobile compatibility
const Icons = {
  wallet: '💳',
  buy: '🟢',
  sell: '🔴',
  settings: '⚙️',
  orders: '📋',
  assets: '💎',
  menu: '☰',
  refresh: '🔄',
  delete: '🗑️',
  copy: '📋',
  plus: '➕',
  minus: '➖'
};

function App() {
  // Main state
  const [dashboardData, setDashboardData] = useState<DashboardData | null>(null);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  // Form states
  const [buyForm, setBuyForm] = useState<BuyTokenInput>({
    wallet_id: 0,
    contract_address: '',
    amount_sol: 0,
    take_profit_percentage: null,
    stop_loss_percentage: null
  });

  const [tokenData, setTokenData] = useState<Token | null>(null);
  const [limitOrders, setLimitOrders] = useState<LimitOrder[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);

  // Wallet forms
  const [createWalletForm, setCreateWalletForm] = useState<CreateWalletInput>({
    name: '',
    address: '',
    private_key: ''
  });

  const [importWalletForm, setImportWalletForm] = useState<ImportWalletInput>({
    name: '',
    private_key: ''
  });

  const [limitOrderForm, setLimitOrderForm] = useState<CreateLimitOrderInput>({
    wallet_id: 0,
    contract_address: '',
    target_price_usd: 0,
    amount_sol: 0,
    auto_execute: false
  });

  // Load initial data
  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await trpc.getDashboardData.query();
      setDashboardData(data);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadWallets = useCallback(async () => {
    try {
      const walletsData = await trpc.getWallets.query();
      setWallets(walletsData);
    } catch (error) {
      console.error('Failed to load wallets:', error);
    }
  }, []);

  const loadLimitOrders = useCallback(async (walletId: number) => {
    try {
      const orders = await trpc.getLimitOrders.query({ walletId });
      setLimitOrders(orders);
    } catch (error) {
      console.error('Failed to load limit orders:', error);
    }
  }, []);

  const loadSettings = useCallback(async (walletId: number) => {
    try {
      const settingsData = await trpc.getSettings.query({ walletId });
      setSettings(settingsData);
    } catch (error) {
      console.error('Failed to load settings:', error);
    }
  }, []);

  const loadTransactions = useCallback(async (walletId: number) => {
    try {
      const transactionsData = await trpc.getTransactions.query({ walletId });
      setTransactions(transactionsData);
    } catch (error) {
      console.error('Failed to load transactions:', error);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    loadWallets();
  }, [loadDashboardData, loadWallets]);

  useEffect(() => {
    if (dashboardData?.active_wallet) {
      const walletId = dashboardData.active_wallet.id;
      setBuyForm(prev => ({ ...prev, wallet_id: walletId }));
      setLimitOrderForm(prev => ({ ...prev, wallet_id: walletId }));
      loadLimitOrders(walletId);
      loadSettings(walletId);
      loadTransactions(walletId);
    }
  }, [dashboardData?.active_wallet, loadLimitOrders, loadSettings, loadTransactions]);

  // Handlers
  const handleCreateWallet = async () => {
    try {
      setIsLoading(true);
      await trpc.createWallet.mutate(createWalletForm);
      await loadWallets();
      await loadDashboardData();
      setCreateWalletForm({ name: '', address: '', private_key: '' });
    } catch (error) {
      console.error('Failed to create wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleImportWallet = async () => {
    try {
      setIsLoading(true);
      await trpc.importWallet.mutate(importWalletForm);
      await loadWallets();
      await loadDashboardData();
      setImportWalletForm({ name: '', private_key: '' });
    } catch (error) {
      console.error('Failed to import wallet:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSetActiveWallet = async (walletId: number) => {
    try {
      await trpc.setActiveWallet.mutate({ walletId });
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to set active wallet:', error);
    }
  };

  const handleDeleteWallet = async (walletId: number) => {
    try {
      await trpc.deleteWallet.mutate({ walletId });
      await loadWallets();
      await loadDashboardData();
    } catch (error) {
      console.error('Failed to delete wallet:', error);
    }
  };

  const handleGetTokenData = async () => {
    if (!buyForm.contract_address) return;
    try {
      const data = await trpc.getTokenData.query({ contract_address: buyForm.contract_address });
      setTokenData(data);
    } catch (error) {
      console.error('Failed to get token data:', error);
    }
  };

  const handleBuyToken = async () => {
    try {
      setIsLoading(true);
      await trpc.buyToken.mutate(buyForm);
      await loadDashboardData();
      if (dashboardData?.active_wallet) {
        await loadTransactions(dashboardData.active_wallet.id);
      }
      setBuyForm(prev => ({ 
        ...prev, 
        contract_address: '', 
        amount_sol: 0, 
        take_profit_percentage: null, 
        stop_loss_percentage: null 
      }));
      setTokenData(null);
    } catch (error) {
      console.error('Failed to buy token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSellToken = async (tokenHoldingId: number, quantity: number) => {
    if (!dashboardData?.active_wallet) return;
    try {
      setIsLoading(true);
      await trpc.sellToken.mutate({
        wallet_id: dashboardData.active_wallet.id,
        token_holding_id: tokenHoldingId,
        quantity
      });
      await loadDashboardData();
      await loadTransactions(dashboardData.active_wallet.id);
    } catch (error) {
      console.error('Failed to sell token:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateLimitOrder = async () => {
    try {
      setIsLoading(true);
      await trpc.createLimitOrder.mutate(limitOrderForm);
      if (dashboardData?.active_wallet) {
        await loadLimitOrders(dashboardData.active_wallet.id);
      }
      setLimitOrderForm(prev => ({
        ...prev,
        contract_address: '',
        target_price_usd: 0,
        amount_sol: 0,
        auto_execute: false
      }));
    } catch (error) {
      console.error('Failed to create limit order:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelLimitOrder = async (orderId: number) => {
    try {
      await trpc.cancelLimitOrder.mutate({ orderId });
      if (dashboardData?.active_wallet) {
        await loadLimitOrders(dashboardData.active_wallet.id);
      }
    } catch (error) {
      console.error('Failed to cancel limit order:', error);
    }
  };

  const handleUpdateSettings = async (updatedSettings: Partial<UpdateSettingsInput>) => {
    if (!dashboardData?.active_wallet) return;
    try {
      await trpc.updateSettings.mutate({
        wallet_id: dashboardData.active_wallet.id,
        ...updatedSettings
      });
      await loadSettings(dashboardData.active_wallet.id);
    } catch (error) {
      console.error('Failed to update settings:', error);
    }
  };

  const formatAddress = (address: string) => {
    return `${address.slice(0, 4)}...${address.slice(-4)}`;
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return 'N/A';
    return `$${price.toFixed(6)}`;
  };

  const formatPnL = (percentage: number) => {
    const isPositive = percentage >= 0;
    return (
      <span className={isPositive ? 'text-green-600' : 'text-red-600'}>
        {isPositive ? '+' : ''}{percentage.toFixed(2)}%
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 text-white">
      <div className="container mx-auto p-4 max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-orange-500 bg-clip-text text-transparent">
            ⚡ Solana Sniper
          </h1>
          <Button
            variant="ghost"
            size="sm"
            onClick={loadDashboardData}
            disabled={isLoading}
            className="text-white hover:bg-white/10"
          >
            {Icons.refresh}
          </Button>
        </div>

        {/* Active Wallet Card */}
        {dashboardData?.active_wallet ? (
          <Card className="mb-4 bg-gradient-to-r from-purple-800/50 to-blue-800/50 border-purple-500/30">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-purple-200">Active Wallet</span>
                <Badge variant="secondary" className="bg-green-500/20 text-green-300">
                  {Icons.wallet} {dashboardData.active_wallet.name}
                </Badge>
              </div>
              <p className="text-xs text-gray-300 mb-2">
                {formatAddress(dashboardData.active_wallet.address)}
              </p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-lg font-bold text-yellow-400">
                    {dashboardData.active_wallet.sol_balance.toFixed(4)} SOL
                  </p>
                  <p className="text-sm text-gray-300">
                    ${dashboardData.total_holdings_usd.toFixed(2)} USD
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="mb-4 bg-red-900/30 border-red-500/30">
            <CardContent className="p-4 text-center">
              <p className="text-red-300">No active wallet selected</p>
              <p className="text-xs text-red-400 mt-1">Create or import a wallet to get started</p>
            </CardContent>
          </Card>
        )}

        {/* Navigation Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4 bg-black/30">
            <TabsTrigger value="dashboard" className="text-xs data-[state=active]:bg-purple-600">
              {Icons.assets} Assets
            </TabsTrigger>
            <TabsTrigger value="trade" className="text-xs data-[state=active]:bg-purple-600">
              {Icons.buy} Trade
            </TabsTrigger>
            <TabsTrigger value="more" className="text-xs data-[state=active]:bg-purple-600">
              {Icons.menu} More
            </TabsTrigger>
          </TabsList>

          {/* Assets Tab */}
          <TabsContent value="dashboard" className="space-y-4">
            {dashboardData?.token_holdings && dashboardData.token_holdings.length > 0 ? (
              <div className="space-y-3">
                {dashboardData.token_holdings.map((holding) => (
                  <Card key={holding.id} className="bg-black/30 border-gray-700">
                    <CardContent className="p-4">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <h3 className="font-semibold text-white">
                            {holding.token.name || holding.token.symbol || 'Unknown Token'}
                          </h3>
                          <p className="text-xs text-gray-400">
                            {formatAddress(holding.token.contract_address)}
                          </p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-yellow-400">
                            ${holding.current_value_usd.toFixed(2)}
                          </p>
                          {formatPnL(holding.pnl_percentage)}
                        </div>
                      </div>
                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-400">
                          <p>Qty: {holding.quantity.toFixed(6)}</p>
                          <p>Avg: {holding.purchase_price_sol.toFixed(6)} SOL</p>
                        </div>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="destructive" size="sm">
                              {Icons.sell} Sell
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent className="bg-gray-900 border-gray-700">
                            <AlertDialogHeader>
                              <AlertDialogTitle className="text-white">Sell Token</AlertDialogTitle>
                              <AlertDialogDescription className="text-gray-300">
                                Sell all {holding.quantity.toFixed(6)} tokens?
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel className="bg-gray-700 text-white">Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => handleSellToken(holding.id, holding.quantity)}
                                className="bg-red-600 hover:bg-red-700"
                              >
                                Sell All
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-black/30 border-gray-700">
                <CardContent className="p-8 text-center">
                  <p className="text-gray-400">No token holdings found</p>
                  <p className="text-xs text-gray-500 mt-2">Buy some tokens to see them here</p>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Trade Tab */}
          <TabsContent value="trade" className="space-y-4">
            <Tabs defaultValue="buy" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-black/30">
                <TabsTrigger value="buy" className="data-[state=active]:bg-green-600">
                  {Icons.buy} Buy
                </TabsTrigger>
                <TabsTrigger value="orders" className="data-[state=active]:bg-blue-600">
                  {Icons.orders} Orders
                </TabsTrigger>
              </TabsList>

              {/* Buy Token */}
              <TabsContent value="buy" className="space-y-4">
                <Card className="bg-black/30 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg text-green-400">Buy Token</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="contract-address" className="text-gray-300">Contract Address</Label>
                      <div className="flex space-x-2 mt-1">
                        <Input
                          id="contract-address"
                          value={buyForm.contract_address}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setBuyForm(prev => ({ ...prev, contract_address: e.target.value }))
                          }
                          placeholder="Enter token contract address"
                          className="bg-black/50 border-gray-600 text-white"
                        />
                        <Button
                          onClick={handleGetTokenData}
                          disabled={!buyForm.contract_address}
                          variant="outline"
                          size="sm"
                        >
                          Load
                        </Button>
                      </div>
                    </div>

                    {tokenData && (
                      <Card className="bg-blue-900/30 border-blue-700">
                        <CardContent className="p-3">
                          <h4 className="font-semibold text-blue-300">
                            {tokenData.name || tokenData.symbol || 'Unknown Token'}
                          </h4>
                          <p className="text-xs text-blue-400">
                            Price: {formatPrice(tokenData.price_usd)}
                          </p>
                          <p className="text-xs text-gray-400">
                            Decimals: {tokenData.decimals}
                          </p>
                        </CardContent>
                      </Card>
                    )}

                    <div>
                      <Label htmlFor="amount-sol" className="text-gray-300">Amount (SOL)</Label>
                      <Input
                        id="amount-sol"
                        type="number"
                        value={buyForm.amount_sol}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setBuyForm(prev => ({ ...prev, amount_sol: parseFloat(e.target.value) || 0 }))
                        }
                        placeholder="0.0"
                        step="0.001"
                        min="0"
                        className="bg-black/50 border-gray-600 text-white mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="take-profit" className="text-gray-300">Take Profit (%)</Label>
                        <Input
                          id="take-profit"
                          type="number"
                          value={buyForm.take_profit_percentage || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setBuyForm(prev => ({ 
                              ...prev, 
                              take_profit_percentage: e.target.value ? parseFloat(e.target.value) : null 
                            }))
                          }
                          placeholder="Optional"
                          className="bg-black/50 border-gray-600 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="stop-loss" className="text-gray-300">Stop Loss (%)</Label>
                        <Input
                          id="stop-loss"
                          type="number"
                          value={buyForm.stop_loss_percentage || ''}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setBuyForm(prev => ({ 
                              ...prev, 
                              stop_loss_percentage: e.target.value ? parseFloat(e.target.value) : null 
                            }))
                          }
                          placeholder="Optional"
                          className="bg-black/50 border-gray-600 text-white mt-1"
                        />
                      </div>
                    </div>

                    <Button
                      onClick={handleBuyToken}
                      disabled={isLoading || !buyForm.contract_address || !buyForm.amount_sol || !dashboardData?.active_wallet}
                      className="w-full bg-green-600 hover:bg-green-700"
                    >
                      {isLoading ? 'Processing...' : `${Icons.buy} Buy Token`}
                    </Button>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Limit Orders */}
              <TabsContent value="orders" className="space-y-4">
                <Card className="bg-black/30 border-gray-700">
                  <CardHeader>
                    <CardTitle className="text-lg text-blue-400">Create Limit Order</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label htmlFor="limit-contract" className="text-gray-300">Contract Address</Label>
                      <Input
                        id="limit-contract"
                        value={limitOrderForm.contract_address}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setLimitOrderForm(prev => ({ ...prev, contract_address: e.target.value }))
                        }
                        placeholder="Enter token contract address"
                        className="bg-black/50 border-gray-600 text-white mt-1"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="target-price" className="text-gray-300">Target Price (USD)</Label>
                        <Input
                          id="target-price"
                          type="number"
                          value={limitOrderForm.target_price_usd}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setLimitOrderForm(prev => ({ ...prev, target_price_usd: parseFloat(e.target.value) || 0 }))
                          }
                          placeholder="0.0"
                          step="0.000001"
                          min="0"
                          className="bg-black/50 border-gray-600 text-white mt-1"
                        />
                      </div>
                      <div>
                        <Label htmlFor="limit-amount" className="text-gray-300">Amount (SOL)</Label>
                        <Input
                          id="limit-amount"
                          type="number"
                          value={limitOrderForm.amount_sol}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setLimitOrderForm(prev => ({ ...prev, amount_sol: parseFloat(e.target.value) || 0 }))
                          }
                          placeholder="0.0"
                          step="0.001"
                          min="0"
                          className="bg-black/50 border-gray-600 text-white mt-1"
                        />
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <Switch
                        id="auto-execute"
                        checked={limitOrderForm.auto_execute}
                        onCheckedChange={(checked: boolean) =>
                          setLimitOrderForm(prev => ({ ...prev, auto_execute: checked }))
                        }
                      />
                      <Label htmlFor="auto-execute" className="text-gray-300">Auto-execute when reached</Label>
                    </div>

                    <Button
                      onClick={handleCreateLimitOrder}
                      disabled={isLoading || !limitOrderForm.contract_address || !limitOrderForm.target_price_usd || !limitOrderForm.amount_sol}
                      className="w-full bg-blue-600 hover:bg-blue-700"
                    >
                      {isLoading ? 'Creating...' : `${Icons.orders} Create Order`}
                    </Button>
                  </CardContent>
                </Card>

                {/* Active Orders */}
                {limitOrders.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-lg font-semibold text-blue-400">Active Orders</h3>
                    {limitOrders.map((order) => (
                      <Card key={order.id} className="bg-black/30 border-gray-700">
                        <CardContent className="p-4">
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <p className="text-sm font-medium text-white">
                                {formatAddress(order.token_id.toString())}
                              </p>
                              <p className="text-xs text-gray-400">
                                Target: ${order.target_price_usd.toFixed(6)}
                              </p>
                            </div>
                            <Badge variant={order.auto_execute ? "default" : "secondary"}>
                              {order.auto_execute ? 'Auto' : 'Manual'}
                            </Badge>
                          </div>
                          <div className="flex justify-between items-center">
                            <p className="text-xs text-gray-400">
                              Amount: {order.amount_sol.toFixed(4)} SOL
                            </p>
                            <Button
                              onClick={() => handleCancelLimitOrder(order.id)}
                              variant="destructive"
                              size="sm"
                            >
                              Cancel
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </TabsContent>

          {/* More Tab */}
          <TabsContent value="more" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="h-20 flex-col bg-black/30 border-gray-700 hover:bg-white/10">
                    <span className="text-2xl mb-1">{Icons.wallet}</span>
                    <span className="text-xs">Wallets</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="bg-gray-900 border-gray-700">
                  <SheetHeader>
                    <SheetTitle className="text-white">Wallet Management</SheetTitle>
                  </SheetHeader>
                  <div className="space-y-4 mt-4">
                    <Tabs defaultValue="manage" className="w-full">
                      <TabsList className="grid w-full grid-cols-3 bg-black/30">
                        <TabsTrigger value="manage" className="text-xs">Manage</TabsTrigger>
                        <TabsTrigger value="create" className="text-xs">Create</TabsTrigger>
                        <TabsTrigger value="import" className="text-xs">Import</TabsTrigger>
                      </TabsList>

                      <TabsContent value="manage" className="space-y-3">
                        {wallets.map((wallet) => (
                          <Card key={wallet.id} className="bg-black/30 border-gray-700">
                            <CardContent className="p-3">
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="font-medium text-white">{wallet.name}</p>
                                  <p className="text-xs text-gray-400">{formatAddress(wallet.address)}</p>
                                  <p className="text-xs text-yellow-400">{wallet.sol_balance.toFixed(4)} SOL</p>
                                </div>
                                <div className="flex space-x-2">
                                  {dashboardData?.active_wallet?.id !== wallet.id ? (
                                    <Button
                                      onClick={() => handleSetActiveWallet(wallet.id)}
                                      size="sm"
                                      variant="outline"
                                    >
                                      Select
                                    </Button>
                                  ) : (
                                    <Badge variant="default" className="bg-green-600">Active</Badge>
                                  )}
                                  <AlertDialog>
                                    <AlertDialogTrigger asChild>
                                      <Button variant="destructive" size="sm">
                                        {Icons.delete}
                                      </Button>
                                    </AlertDialogTrigger>
                                    <AlertDialogContent className="bg-gray-900 border-gray-700">
                                      <AlertDialogHeader>
                                        <AlertDialogTitle className="text-white">Delete Wallet</AlertDialogTitle>
                                        <AlertDialogDescription className="text-gray-300">
                                          Are you sure you want to delete "{wallet.name}"? This action cannot be undone.
                                        </AlertDialogDescription>
                                      </AlertDialogHeader>
                                      <AlertDialogFooter>
                                        <AlertDialogCancel className="bg-gray-700 text-white">Cancel</AlertDialogCancel>
                                        <AlertDialogAction
                                          onClick={() => handleDeleteWallet(wallet.id)}
                                          className="bg-red-600 hover:bg-red-700"
                                        >
                                          Delete
                                        </AlertDialogAction>
                                      </AlertDialogFooter>
                                    </AlertDialogContent>
                                  </AlertDialog>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </TabsContent>

                      <TabsContent value="create" className="space-y-4">
                        <div>
                          <Label htmlFor="wallet-name" className="text-gray-300">Wallet Name</Label>
                          <Input
                            id="wallet-name"
                            value={createWalletForm.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateWalletForm(prev => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="My Wallet"
                            className="bg-black/50 border-gray-600 text-white mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="wallet-address" className="text-gray-300">Address</Label>
                          <Input
                            id="wallet-address"
                            value={createWalletForm.address}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateWalletForm(prev => ({ ...prev, address: e.target.value }))
                            }
                            placeholder="Solana wallet address"
                            className="bg-black/50 border-gray-600 text-white mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="wallet-private-key" className="text-gray-300">Private Key</Label>
                          <Input
                            id="wallet-private-key"
                            type="password"
                            value={createWalletForm.private_key}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCreateWalletForm(prev => ({ ...prev, private_key: e.target.value }))
                            }
                            placeholder="Private key"
                            className="bg-black/50 border-gray-600 text-white mt-1"
                          />
                        </div>
                        <Button
                          onClick={handleCreateWallet}
                          disabled={isLoading || !createWalletForm.name || !createWalletForm.address || !createWalletForm.private_key}
                          className="w-full bg-green-600 hover:bg-green-700"
                        >
                          {isLoading ? 'Creating...' : 'Create Wallet'}
                        </Button>
                      </TabsContent>

                      <TabsContent value="import" className="space-y-4">
                        <div>
                          <Label htmlFor="import-name" className="text-gray-300">Wallet Name</Label>
                          <Input
                            id="import-name"
                            value={importWalletForm.name}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setImportWalletForm(prev => ({ ...prev, name: e.target.value }))
                            }
                            placeholder="My Imported Wallet"
                            className="bg-black/50 border-gray-600 text-white mt-1"
                          />
                        </div>
                        <div>
                          <Label htmlFor="import-private-key" className="text-gray-300">Private Key</Label>
                          <Input
                            id="import-private-key"
                            type="password"
                            value={importWalletForm.private_key}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setImportWalletForm(prev => ({ ...prev, private_key: e.target.value }))
                            }
                            placeholder="Enter private key to import"
                            className="bg-black/50 border-gray-600 text-white mt-1"
                          />
                        </div>
                        <Button
                          onClick={handleImportWallet}
                          disabled={isLoading || !importWalletForm.name || !importWalletForm.private_key}
                          className="w-full bg-blue-600 hover:bg-blue-700"
                        >
                          {isLoading ? 'Importing...' : 'Import Wallet'}
                        </Button>
                      </TabsContent>
                    </Tabs>
                  </div>
                </SheetContent>
              </Sheet>

              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" className="h-20 flex-col bg-black/30 border-gray-700 hover:bg-white/10">
                    <span className="text-2xl mb-1">{Icons.settings}</span>
                    <span className="text-xs">Settings</span>
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="bg-gray-900 border-gray-700">
                  <SheetHeader>
                    <SheetTitle className="text-white">Settings</SheetTitle>
                  </SheetHeader>
                  {settings && (
                    <div className="space-y-4 mt-4">
                      <div>
                        <Label htmlFor="slippage" className="text-gray-300">Slippage Tolerance (%)</Label>
                        <Input
                          id="slippage"
                          type="number"
                          value={settings.slippage_percentage}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleUpdateSettings({ slippage_percentage: parseFloat(e.target.value) || 0 })
                          }
                          step="0.1"
                          min="0"
                          max="100"
                          className="bg-black/50 border-gray-600 text-white mt-1"
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <Label htmlFor="mev-protection" className="text-gray-300">MEV Protection</Label>
                        <Switch
                          id="mev-protection"
                          checked={settings.mev_protection}
                          onCheckedChange={(checked: boolean) =>
                            handleUpdateSettings({ mev_protection: checked })
                          }
                        />
                      </div>
                      <div>
                        <Label htmlFor="alert-mode" className="text-gray-300">Alert Mode</Label>
                        <Select
                          value={settings.alert_mode || 'popup'}
                          onValueChange={(value: 'popup' | 'silent') =>
                            handleUpdateSettings({ alert_mode: value })
                          }
                        >
                          <SelectTrigger className="bg-black/50 border-gray-600 text-white mt-1">
                            <SelectValue placeholder="Select alert mode" />
                          </SelectTrigger>
                          <SelectContent className="bg-gray-800 border-gray-700">
                            <SelectItem value="popup" className="text-white">Popup</SelectItem>
                            <SelectItem value="silent" className="text-white">Silent</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                </SheetContent>
              </Sheet>
            </div>

            {/* Recent Transactions */}
            {transactions.length > 0 && (
              <Card className="bg-black/30 border-gray-700">
                <CardHeader>
                  <CardTitle className="text-lg text-gray-300">Recent Transactions</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {transactions.slice(0, 5).map((tx) => (
                    <div key={tx.id} className="flex justify-between items-center p-2 bg-black/20 rounded">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {tx.type === 'buy' ? Icons.buy : Icons.sell} {tx.type.toUpperCase()}
                        </p>
                        <p className="text-xs text-gray-400">
                          {tx.token_quantity.toFixed(6)} tokens
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm text-yellow-400">
                          {tx.amount_sol.toFixed(4)} SOL
                        </p>
                        <Badge variant={
                          tx.status === 'completed' ? 'default' : 
                          tx.status === 'pending' ? 'secondary' : 'destructive'
                        }>
                          {tx.status}
                        </Badge>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}

export default App;
