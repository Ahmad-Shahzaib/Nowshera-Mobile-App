// API Response Types
export interface InvoiceApiResponse {
  status: boolean;
  pagination: {
    total: number;
    per_page: number;
    current_page: number;
    last_page: number;
  };
  invoices: InvoiceApi[];
}

export interface InvoiceApi {
  id: number;
  invoice_id: number;
  customer_id: number;
  customer_name: string | null;
  warehouse_id: number;
  warehouse_name: string;
  status: number; // 1=Paid, 2=Partially Paid, 3=Unpaid
  issue_date: string;
  sub_total: number;
  discount_total: number;
  tax_total: number;
  grand_total: number;
  due_amount: number;
  customer: {
    id: number;
    name: string;
  } | null;
}

// Invoice Detail API Types (for /invoice/:id/edit endpoint)
export interface InvoiceDetailItem {
  id: number;
  quantity: number;
  price: string;
  discount: number;
  discount_percentage: string;
  tax: string | null;
  description: string;
  subtotal: number;
}

export interface InvoicePayment {
  id: number;
  date: string;
  amount: string;
  account_id: number;
  payment_method: number;
  reference: string;
  description: string;
}

export interface InvoiceTotals {
  sub_total: number;
  discount: number;
  tax: number;
  total: number;
  paid: number;
  due: number;
}

export interface InvoiceDetailApi {
  id: number;
  invoice_number: number;
  issue_date: string;
  due_date: string;
  warehouse_id: number;
  category_id: number;
  customer_id: number;
  customer_name: string;
  contact_number: string | null;
  address: string | null;
  delivery_status: string;
  current_balance: string;
  discount_apply: number;
  ref_number: string | null;
  status: number; // 1=Paid, 2=Partially Paid, 3=Unpaid
  sale_type: string;
}

export interface InvoiceDetailApiResponse {
  success: boolean;
  invoice: InvoiceDetailApi;
  items: InvoiceDetailItem[];
  payments: InvoicePayment[];
  totals: InvoiceTotals;
}

// App Types
export interface Invoice {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  customerType?: string;
  categoryId?: string;
  warehouseId?: string;
  warehouseName?: string;
  refNumber?: string;
  deliveryStatus?: string;
  issueDate: string;
  dueDate?: string;
  subTotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  dueAmount: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
  serverId?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: number;
  syncStatus?: 'UNSYNCED' | 'SYNCED' | 'FAILED';
  syncError?: string | null;
}

export interface InvoiceRow {
  id: string;
  invoiceNo: string;
  customerId: string;
  customerName: string;
  warehouseId?: string;
  warehouseName?: string;
  issueDate: string;
  dueDate?: string;
  subTotal: string;
  discountTotal: string;
  taxTotal: string;
  grandTotal: string;
  dueAmount: string;
  status: 'Paid' | 'Partially Paid' | 'Unpaid';
  serverId?: string | null;
  createdAt: string;
  updatedAt: string;
  synced: number;
  syncStatus?: 'UNSYNCED' | 'SYNCED' | 'FAILED';
  syncError?: string | null;
}
