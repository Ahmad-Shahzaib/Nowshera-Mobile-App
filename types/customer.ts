export interface Customer {
  id: number;
  customer_id: number;
  chart_of_accounts_id: number;
  chart_of_accounts_name: string;
  warehouse_id: number;
  warehouse_name: string;
  name: string;
  type: string;
  email: string;
  tax_number: string | null;
  contact: string;
  avatar: string;
  created_by: number;
  is_active: number;
  email_verified_at: string | null;
  billing_name: string;
  billing_country: string;
  billing_state: string | null;
  billing_city: string;
  billing_phone: string;
  billing_zip: string | null;
  billing_address: string;
  shipping_name: string | null;
  shipping_country: string | null;
  shipping_state: string | null;
  shipping_city: string | null;
  shipping_phone: string | null;
  shipping_zip: string | null;
  shipping_address: string | null;
  lang: string;
  balance: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerResponse {
  is_success: boolean;
  message: string;
  data: Customer[];
}
