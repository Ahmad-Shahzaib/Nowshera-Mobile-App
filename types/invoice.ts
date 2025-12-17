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
}
