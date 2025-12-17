export type Dealer = {
  id: number;
  name: string;
  syncedAt?: number;
};

export type DealerResponse = {
  data: Dealer[];
};
