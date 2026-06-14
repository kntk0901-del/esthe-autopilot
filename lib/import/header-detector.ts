const aliases: Record<string, string[]> = {
  date: ["日付", "売上日", "来店日", "date"],
  store: ["店舗", "店舗名", "店名", "store"],
  therapist: ["セラピスト", "担当", "担当者", "スタッフ", "therapist"],
  sales: ["売上", "売上金額", "金額", "合計", "sales"],
  course: ["コース", "分数", "コース時間", "course"],
  customerType: ["顧客区分", "新規再来", "顧客", "customer_type"],
  nomination: ["指名", "指名有無", "nomination"],
  status: ["状態", "ステータス", "status"],
  source: ["流入", "媒体", "source"],
  startTime: ["開始", "開始時刻", "予約時刻", "start_time"],
  payment: ["報酬", "取り分", "支払額", "therapist_payment"],
  discount: ["値引", "割引", "discount"],
};

function normalizeHeader(value: unknown): string {
  return String(value ?? "")
    .normalize("NFKC")
    .replace(/[\s　_\-]/g, "")
    .toLowerCase();
}

export interface DetectedHeader {
  rowIndex: number;
  columns: Record<string, number>;
  score: number;
}

export function detectHeader(rows: unknown[][]): DetectedHeader {
  let best: DetectedHeader = { rowIndex: 0, columns: {}, score: 0 };
  rows.slice(0, 30).forEach((row, rowIndex) => {
    const columns: Record<string, number> = {};
    row.forEach((cell, columnIndex) => {
      const normalized = normalizeHeader(cell);
      Object.entries(aliases).forEach(([key, candidates]) => {
        if (
          candidates.some((candidate) => normalizeHeader(candidate) === normalized)
        ) {
          columns[key] = columnIndex;
        }
      });
    });
    const score = Object.keys(columns).length;
    if (score > best.score) {
      best = { rowIndex, columns, score };
    }
  });
  return best;
}
