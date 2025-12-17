export interface Product {
  id: number;
  label: string;
  name?: string;
  sku?: string;
  sale_price?: string;
  purchase_price?: string;
  description?: string;
  type?: string;
  category_id?: number;
  unit_id?: number;
  syncedAt?: number;
}

export interface ProductsResponse {
  data: Product[];
}

export interface Category {
  id: number;
  name: string;
  syncedAt?: number;
}

export interface CategoriesResponse {
  data: Category[];
}
