export interface BankAccount {
  id: number;
  warehouse_id: number;
  holder_name: string;
  bank_name: string;
  account_number: string;
  chart_account_id: number;
  opening_balance: number;
  contact_number: string;
  bank_address: string;
  created_by: number;
  shop_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccountRow {
  id: number;
  warehouseId: number;
  holderName: string;
  bankName: string;
  accountNumber: string;
  chartAccountId: number;
  openingBalance: number;
  contactNumber: string;
  bankAddress: string;
  createdBy: number;
  shopId: number | null;
  createdAt: string;
  updatedAt: string;
  syncedAt?: number;
}
