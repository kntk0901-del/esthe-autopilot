import type { AppData, Store } from "@/lib/types";

export interface StoreMetrics {
  store: Store;
  sales: number;
  bookings: number;
  averageTicket: number;
  grossProfit: number;
  grossProfitEstimated: boolean;
  newCustomers: number;
  repeatCustomers: number;
  nominations: number;
  monthlyProgress: number;
  workingTherapists: number;
  postCount: number;
}

export function calculateStoreMetrics(
  data: AppData,
  from: string,
  to: string,
): StoreMetrics[] {
  return data.stores.map((store) => {
    const records = data.salesRecords.filter(
      (record) =>
        record.store_id === store.id &&
        record.sales_date >= from &&
        record.sales_date <= to &&
        record.status !== "キャンセル",
    );
    const sales = records.reduce((sum, record) => sum + record.sales_amount, 0);
    return {
      store,
      sales,
      bookings: records.length,
      averageTicket: records.length > 0 ? sales / records.length : 0,
      grossProfit: records.reduce(
        (sum, record) =>
          sum +
          (record.gross_profit ??
            Math.round(
              record.sales_amount *
                (1 - data.systemSettings.defaultTherapistPaymentRate),
            )),
        0,
      ),
      grossProfitEstimated: records.some((record) => record.gross_profit === null),
      newCustomers: records.filter((record) => record.customer_type === "新規")
        .length,
      repeatCustomers: records.filter((record) => record.customer_type === "再来")
        .length,
      nominations: records.filter((record) => record.nomination === "Y").length,
      monthlyProgress: store.monthly_target > 0 ? sales / store.monthly_target : 0,
      workingTherapists: new Set(
        records
          .map((record) => record.therapist_id)
          .filter((id): id is string => Boolean(id)),
      ).size,
      postCount: data.posts.filter(
        (post) =>
          post.store_id === store.id &&
          post.post_date >= from &&
          post.post_date <= to &&
          post.status === "posted",
      ).length,
    };
  });
}
