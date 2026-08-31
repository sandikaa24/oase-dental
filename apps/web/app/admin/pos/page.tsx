'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/lib/auth-context';
import { fetchApi, ApiError } from '@/lib/api-client';
import {
  type PosCatalogItem,
  type PosCartItem,
  type PosTransaction,
  type PosPayment,
} from '@/components/pos/pos-types';
import { PosCatalog } from '@/components/pos/pos-catalog';
import { PosCart } from '@/components/pos/pos-cart';
import { PosPaymentModal } from '@/components/pos/pos-payment-modal';
import { PosReceiptModal } from '@/components/pos/pos-receipt-modal';
import { PosTransactionHistory } from '@/components/pos/pos-transaction-history';
import { ErrorBanner } from '@/components/ui/placeholder';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  LayoutGrid,
  History,
  CheckCircle2,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function PosPage() {
  const { user } = useAuth();

  // Active Tab: 'POS' (Katalog + Keranjang) or 'HISTORY' (Riwayat Transaksi)
  const [activeTab, setActiveTab] = useState<'POS' | 'HISTORY'>('POS');

  // Data States
  const [catalogItems, setCatalogItems] = useState<PosCatalogItem[]>([]);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState(true);

  const [transactions, setTransactions] = useState<PosTransaction[]>([]);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(false);

  // Cart State
  const [cartItems, setCartItems] = useState<PosCartItem[]>([]);
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [discountAmount, setDiscountAmount] = useState('0');
  const [discountReason, setDiscountReason] = useState('');
  const [activeDraftId, setActiveDraftId] = useState<string | null>(null);

  // Modals & Process States
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  const [receiptModalOpen, setReceiptModalOpen] = useState(false);
  const [completedTransaction, setCompletedTransaction] = useState<PosTransaction | null>(null);

  // Cancel Modal (Owner only)
  const [cancelModalOpen, setCancelModalOpen] = useState(false);
  const [trxToCancel, setTrxToCancel] = useState<PosTransaction | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Global Page Error / Success Flash
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Load Catalog
  const loadCatalog = useCallback(async () => {
    try {
      setIsLoadingCatalog(true);
      const res = await fetchApi<PosCatalogItem[]>('/api/v1/pos/catalog');
      if (res.success && res.data) {
        setCatalogItems(res.data);
      }
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Gagal memuat katalog POS');
    } finally {
      setIsLoadingCatalog(false);
    }
  }, []);

  // Load History
  const loadTransactions = useCallback(async () => {
    try {
      setIsLoadingTransactions(true);
      const res = await fetchApi<PosTransaction[]>('/api/v1/transactions?limit=50');
      if (res.success && res.data) {
        setTransactions(res.data);
      }
    } catch {
      // Ignore background fetch error
    } finally {
      setIsLoadingTransactions(false);
    }
  }, []);

  useEffect(() => {
    loadCatalog();
    loadTransactions();
  }, [loadCatalog, loadTransactions, user?.activeBranchId]);

  // Cart Operations
  const handleAddToCart = (item: PosCatalogItem) => {
    setGlobalError(null);
    setCartItems((prev) => {
      const existing = prev.find((ci) => ci.itemId === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.itemId === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci
        );
      }
      return [
        ...prev,
        {
          id: `cart-${Date.now()}-${item.id}`,
          itemId: item.id,
          itemType: item.type,
          name: item.name,
          price: item.price,
          quantity: 1,
          availableStock: item.stock,
          unit: item.unit,
        },
      ];
    });
  };

  const handleUpdateQuantity = (itemId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(itemId);
      return;
    }
    setCartItems((prev) =>
      prev.map((ci) => (ci.itemId === itemId ? { ...ci, quantity: newQty } : ci))
    );
  };

  const handleRemoveItem = (itemId: string) => {
    setCartItems((prev) => prev.filter((ci) => ci.itemId !== itemId));
  };

  const handleClearCart = () => {
    setCartItems([]);
    setPatientName('');
    setPatientPhone('');
    setDiscountAmount('0');
    setDiscountReason('');
    setActiveDraftId(null);
    setGlobalError(null);
  };

  // Save DRAFT
  const handleSaveDraft = async () => {
    if (cartItems.length === 0) return;

    try {
      setIsSavingDraft(true);
      setGlobalError(null);

      const payload = {
        items: cartItems.map((ci) => ({
          itemType: ci.itemType,
          itemId: ci.itemId,
          quantity: ci.quantity,
        })),
        patientName: patientName.trim() || null,
        patientPhone: patientPhone.trim() || null,
        discountAmount: discountAmount.trim() || '0',
        discountReason: discountReason.trim() || null,
      };

      let res;
      if (activeDraftId) {
        // Edit existing draft
        res = await fetchApi<PosTransaction>(`/api/v1/transactions/${activeDraftId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      } else {
        // Create new draft
        res = await fetchApi<PosTransaction>('/api/v1/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      if (res.success && res.data) {
        setActiveDraftId(res.data.id);
        setSuccessMessage(`DRAFT transaksi (${res.data.transactionNumber}) berhasil disimpan`);
        loadTransactions();
        setTimeout(() => setSuccessMessage(null), 4000);
      }
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Gagal menyimpan draft');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Open Payment Flow
  const handleOpenPayment = () => {
    if (cartItems.length === 0) return;
    setPaymentError(null);
    setIsPaymentModalOpen(true);
  };

  // Submit Payment
  const handleProcessPayment = async (payments: PosPayment[]) => {
    try {
      setIsProcessingPayment(true);
      setPaymentError(null);

      // Step 1: Pastikan transaksi tersimpan sebagai draft (atau update jika sudah ada)
      const payload = {
        items: cartItems.map((ci) => ({
          itemType: ci.itemType,
          itemId: ci.itemId,
          quantity: ci.quantity,
        })),
        patientName: patientName.trim() || null,
        patientPhone: patientPhone.trim() || null,
        discountAmount: discountAmount.trim() || '0',
        discountReason: discountReason.trim() || null,
      };

      let trxId = activeDraftId;
      if (!trxId) {
        const createRes = await fetchApi<PosTransaction>('/api/v1/transactions', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        if (!createRes.success || !createRes.data) {
          throw new Error('Gagal membuat transaksi');
        }
        trxId = createRes.data.id;
      } else {
        // Update DRAFT sebelum bayar
        await fetchApi(`/api/v1/transactions/${trxId}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
      }

      // Step 2: Kirim pembayaran POST /transactions/:id/pay
      const payRes = await fetchApi<PosTransaction>(`/api/v1/transactions/${trxId}/pay`, {
        method: 'POST',
        body: JSON.stringify({ payments }),
      });

      if (payRes.success && payRes.data) {
        setIsPaymentModalOpen(false);
        setCompletedTransaction(payRes.data);
        setReceiptModalOpen(true);

        // Reset cart dan refresh data
        handleClearCart();
        loadCatalog();
        loadTransactions();
      }
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.code === 'INSUFFICIENT_STOCK') {
          setPaymentError(`Pembayaran gagal: Stok produk tidak mencukupi. ${err.message}`);
        } else if (err.code === 'CLOSING_PERIOD_LOCKED') {
          setPaymentError('Pembayaran ditolak: Periode kasir sudah ditutup (Closing).');
        } else {
          setPaymentError(err.message || 'Pembayaran gagal diproses');
        }
      } else if (err instanceof Error) {
        setPaymentError(err.message);
      } else {
        setPaymentError('Terjadi kesalahan sistem saat pembayaran');
      }
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // Resume Draft from History
  const handleResumeDraft = (trx: PosTransaction) => {
    if (!trx.items) return;

    setActiveDraftId(trx.id);
    setPatientName(trx.patientName || '');
    setPatientPhone(trx.patientPhone || '');
    setDiscountAmount(trx.discountAmount || '0');
    setDiscountReason(trx.discountReason || '');

    setCartItems(
      trx.items.map((i) => ({
        id: `cart-${i.id}`,
        itemId: i.itemId,
        itemType: i.itemType,
        name: i.name,
        price: i.price,
        quantity: i.quantity,
        availableStock: null,
        unit: i.unit,
      }))
    );

    setActiveTab('POS');
    setSuccessMessage(`DRAFT ${trx.transactionNumber} dimuat ke keranjang`);
    setTimeout(() => setSuccessMessage(null), 3000);
  };

  // View Receipt from History
  const handleViewReceipt = (trx: PosTransaction) => {
    setCompletedTransaction(trx);
    setReceiptModalOpen(true);
  };

  // Cancel Transaction (Owner only)
  const handleOpenCancelModal = (trx: PosTransaction) => {
    setTrxToCancel(trx);
    setCancelReason('');
    setCancelModalOpen(true);
  };

  const handleConfirmCancel = async () => {
    if (!trxToCancel || cancelReason.trim().length < 10) return;

    try {
      setIsCancelling(true);
      const res = await fetchApi<PosTransaction>(
        `/api/v1/transactions/${trxToCancel.id}/cancel`,
        {
          method: 'POST',
          body: JSON.stringify({ reason: cancelReason.trim() }),
        }
      );

      if (res.success) {
        setCancelModalOpen(false);
        setSuccessMessage(`Transaksi ${trxToCancel.transactionNumber} berhasil dibatalkan`);
        loadTransactions();
        loadCatalog();
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    } catch (err: unknown) {
      setGlobalError(err instanceof Error ? err.message : 'Gagal membatalkan transaksi');
    } finally {
      setIsCancelling(false);
    }
  };

  // Calculate Subtotal and Total for Cart Header
  const subtotalNum = cartItems.reduce((acc, item) => {
    return acc + (parseFloat(item.price) || 0) * item.quantity;
  }, 0);
  const discountNum = parseFloat(discountAmount) || 0;
  const totalNum = Math.max(0, subtotalNum - discountNum);

  return (
    <div className="space-y-4">
      {/* Top Banner: Tab Navigation */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-border">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-foreground">
            Point of Sale (POS) Kasir
          </h1>
          <p className="text-xs text-muted mt-0.5">
            Pencatatan transaksi layanan tindakan dan penjualan produk klinik
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="flex items-center gap-1 p-1 bg-slate-100/90 rounded-lg border border-border">
          <button
            type="button"
            onClick={() => setActiveTab('POS')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
              activeTab === 'POS'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-slate-600 hover:text-foreground'
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            <span>Kasir Baru</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
              activeTab === 'HISTORY'
                ? 'bg-surface text-primary shadow-xs'
                : 'text-slate-600 hover:text-foreground'
            )}
          >
            <History className="h-3.5 w-3.5" />
            <span>Riwayat Transaksi</span>
          </button>
        </div>
      </div>

      {/* Global Success Banner */}
      {successMessage && (
        <div className="p-3 rounded-lg bg-success-bg border border-success-border text-success-text text-xs flex items-center gap-2 animate-in fade-in-50">
          <CheckCircle2 className="h-4 w-4 shrink-0 text-success-icon" />
          <span className="font-medium">{successMessage}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {globalError && (
        <ErrorBanner
          message={globalError}
          onRetry={() => {
            setGlobalError(null);
            loadCatalog();
            loadTransactions();
          }}
        />
      )}

      {/* POS View (Catalog + Cart 2-Column Layout) */}
      {activeTab === 'POS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column: Catalog (7 cols) */}
          <div className="lg:col-span-7 xl:col-span-8">
            <PosCatalog
              items={catalogItems}
              isLoading={isLoadingCatalog}
              onAddToCart={handleAddToCart}
              cartItems={cartItems}
            />
          </div>

          {/* Right Column: Sticky Cart (5 cols) */}
          <div className="lg:col-span-5 xl:col-span-4 sticky top-20">
            <PosCart
              items={cartItems}
              patientName={patientName}
              patientPhone={patientPhone}
              discountAmount={discountAmount}
              discountReason={discountReason}
              onUpdatePatientName={setPatientName}
              onUpdatePatientPhone={setPatientPhone}
              onUpdateDiscountAmount={setDiscountAmount}
              onUpdateDiscountReason={setDiscountReason}
              onUpdateQuantity={handleUpdateQuantity}
              onRemoveItem={handleRemoveItem}
              onClearCart={handleClearCart}
              onSaveDraft={handleSaveDraft}
              onOpenPayment={handleOpenPayment}
              isSavingDraft={isSavingDraft}
              activeDraftId={activeDraftId}
            />
          </div>
        </div>
      )}

      {/* History View */}
      {activeTab === 'HISTORY' && (
        <PosTransactionHistory
          transactions={transactions}
          isLoading={isLoadingTransactions}
          userRole={user?.role}
          onResumeDraft={handleResumeDraft}
          onViewReceipt={handleViewReceipt}
          onCancelTransaction={handleOpenCancelModal}
        />
      )}

      {/* Payment Dialog Modal */}
      <PosPaymentModal
        open={isPaymentModalOpen}
        onOpenChange={setIsPaymentModalOpen}
        totalAmount={String(totalNum)}
        onProcessPayment={handleProcessPayment}
        isProcessing={isProcessingPayment}
        error={paymentError}
      />

      {/* Printable Receipt Modal */}
      <PosReceiptModal
        open={receiptModalOpen}
        onOpenChange={setReceiptModalOpen}
        transaction={completedTransaction}
        cashierName={user?.name || user?.email?.split('@')[0]}
        onNewTransaction={handleClearCart}
      />

      {/* Cancel Transaction Modal (Owner only) */}
      {cancelModalOpen && trxToCancel && (
        <Dialog open={cancelModalOpen} onOpenChange={setCancelModalOpen}>
          <DialogClose onClose={() => setCancelModalOpen(false)} />
          <DialogHeader>
            <DialogTitle>Batalkan Transaksi</DialogTitle>
            <DialogDescription>
              Transaksi {trxToCancel.transactionNumber} akan dibatalkan dan stok produk akan dipulihkan
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3">
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">
                Alasan Pembatalan (Wajib min. 10 karakter)
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Contoh: Kesalahan input tindakan oleh kasir atau permintaan pembatalan pasien..."
                rows={3}
                className="w-full p-2.5 text-xs rounded-md border border-border bg-surface text-foreground placeholder:text-muted focus:outline-hidden focus:ring-1 focus:ring-danger-border"
              />
            </div>
            {cancelReason.trim().length > 0 && cancelReason.trim().length < 10 && (
              <p className="text-[11px] text-danger-text">
                * Alasan pembatalan minimal 10 karakter (saat ini: {cancelReason.trim().length})
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setCancelModalOpen(false)}
              disabled={isCancelling}
            >
              Kembali
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={handleConfirmCancel}
              disabled={isCancelling || cancelReason.trim().length < 10}
            >
              {isCancelling ? 'Membatalkan...' : 'Konfirmasi Batal'}
            </Button>
          </DialogFooter>
        </Dialog>
      )}
    </div>
  );
}
