import { randomUUID } from "node:crypto";
import * as XLSX from "xlsx";
import { normalizeSalesRow } from "@/lib/import/normalizer";
import { sha256 } from "@/lib/posting/content-hash";
import type { ImportBatch, ImportRow, Store, Therapist } from "@/lib/types";

// 月次売上表形式 (【店】売上シート + 直後のシフトシート + 管理シフト) を
// 列構成の揺れに耐性を持たせて取り込む。旧ツール (AI売上分析ツール.html) の
// detectMonthly / importMonthly を移植し、既存の normalizeSalesRow に接続する。

export interface MonthlyParseOptions {
  fileName: string;
  targetYear: number;
  stores: Store[];
  therapists: Therapist[];
}

interface MonthlyPair {
  salesSheet: string;
  shiftSheet: string | null;
  store: string;
}

type Grid = unknown[][];

function nfkc(value: unknown): string {
  return String(value ?? "").normalize("NFKC").trim();
}

function toNumber(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) ? n : 0;
}

// 人数カウント列の汚れ (金額誤入力など) を遮断する 0-30 のクランプ
function countOf(value: unknown): number {
  const n = typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(n) && n >= 0 && n <= 30 ? Math.round(n) : 0;
}

function gridOf(workbook: XLSX.WorkBook, sheetName: string): Grid {
  const sheet = workbook.Sheets[sheetName];
  if (!sheet) return [];
  return XLSX.utils.sheet_to_json<unknown[]>(sheet, {
    header: 1,
    raw: true,
    defval: null,
  });
}

function roomDigits(value: unknown): string {
  return (nfkc(value).match(/\d{3,4}/) ?? [""])[0];
}

// 【店】売上シートを探し、直後の「シフト...」シートをペアにする
export function detectMonthlyPairs(workbook: XLSX.WorkBook): MonthlyPair[] {
  const names = workbook.SheetNames;
  const pairs: MonthlyPair[] = [];
  names.forEach((sheetName, i) => {
    const match = sheetName.match(/【(.+?)】.*売上|売上.*【(.+?)】/);
    if (!match) return;
    const store = nfkc(match[1] ?? match[2]);
    let shiftSheet: string | null = null;
    for (let j = i + 1; j < names.length; j++) {
      const next = names[j];
      if (/^シフト/.test(next)) {
        shiftSheet = next;
        break;
      }
      if (/売上/.test(next)) break;
    }
    pairs.push({ salesSheet: sheetName, shiftSheet, store });
  });
  return pairs;
}

export function isMonthlyWorkbook(workbook: XLSX.WorkBook): boolean {
  return detectMonthlyPairs(workbook).length > 0;
}

// 管理シフト: 日付 × 部屋番号 × 早遅番 → 名前。シフト表の名前未記入を補完する正解データ。
function buildKanriIndex(workbook: XLSX.WorkBook): Record<string, string> | null {
  const sheetName = workbook.SheetNames.find((s) => /管理シフト/.test(s));
  if (!sheetName) return null;
  const rows = gridOf(workbook, sheetName);
  let headerRow = -1;
  for (let i = 0; i < Math.min(rows.length, 6); i++) {
    if ((rows[i] ?? []).some((c) => c === "日付")) {
      headerRow = i;
      break;
    }
  }
  if (headerRow < 0) return null;
  const roomCols: { col: number; key: string }[] = [];
  (rows[headerRow] ?? []).forEach((cell, j) => {
    if (typeof cell === "string") {
      const key = roomDigits(cell);
      if (key) roomCols.push({ col: j, key });
    }
  });
  if (!roomCols.length) return null;
  const index: Record<string, string> = {};
  let day = 0;
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const d0 = typeof row[0] === "number" ? row[0] : parseFloat(String(row[0]));
    if (Number.isFinite(d0) && d0 >= 1 && d0 <= 31) day = Math.round(d0);
    const slot = row[2];
    if ((slot !== "早番" && slot !== "遅番") || !day) continue;
    roomCols.forEach((rc) => {
      const name = row[rc.col];
      if (typeof name === "string" && name.trim() && !/ダミー/.test(name)) {
        index[`${day}|${rc.key}|${slot}`] = name.trim();
      }
    });
  }
  return index;
}

interface Slot {
  day: number;
  slot: string;
  block: number;
  name: string;
  sales: number;
  payment: number;
  newCount: number;
  repeatCount: number;
  nominationCount: number;
}

// シフトシートから個人別スロットを収集し、名前未記入を補完する
function parseShiftSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  yearMonth: string,
  store: string,
  kanri: Record<string, string> | null,
): { rawRows: Record<string, unknown>[]; resolved: number; unresolved: number } {
  const rows = gridOf(workbook, sheetName);
  // 「売上」ラベルの並びから部屋ブロックの売上列を特定 (先頭4行を走査)
  let salesCols: number[] = [];
  for (let i = 0; i < Math.min(rows.length, 4); i++) {
    const found: number[] = [];
    (rows[i] ?? []).forEach((c, j) => {
      if (c === "売上") found.push(j);
    });
    if (found.length) {
      salesCols = found;
      break;
    }
  }
  if (!salesCols.length) return { rawRows: [], resolved: 0, unresolved: 0 };
  // 各ブロックの部屋名 (売上列の左3列以内の文字列) と部屋番号キー
  const header0 = rows[0] ?? [];
  const rooms = salesCols.map((sc) => {
    for (let j = sc - 1; j >= Math.max(0, sc - 3); j--) {
      const cell = header0[j];
      if (typeof cell === "string" && cell.trim()) return cell.trim();
    }
    return "";
  });
  const roomKeys = rooms.map((room) => roomDigits(room));

  // Pass1: 日 × ブロック × 早遅番 でスロット収集
  const slots: Slot[] = [];
  let day = 0;
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const d0 = typeof row[0] === "number" ? row[0] : parseFloat(String(row[0]));
    if (Number.isFinite(d0) && d0 >= 1 && d0 <= 31) day = Math.round(d0);
    const slot = row[2];
    if ((slot !== "早番" && slot !== "遅番") || !day) continue;
    salesCols.forEach((sc, block) => {
      const nameRaw = row[sc - 1];
      let name = typeof nameRaw === "string" ? nameRaw.trim() : "";
      if (name === "新規/顧客/指名") name = "";
      const sales = toNumber(row[sc]);
      const payment = toNumber(row[sc + 1]);
      const gross = toNumber(row[sc + 2]);
      if (!name && !sales && !payment && !gross) return; // 完全空きスロット
      const nextRow = rows[i + 1] ?? [];
      const hasCounts =
        typeof nextRow[sc - 1] === "string" &&
        String(nextRow[sc - 1]).indexOf("新規") >= 0;
      slots.push({
        day,
        slot,
        block,
        name,
        sales,
        payment,
        newCount: hasCounts ? countOf(nextRow[sc]) : 0,
        repeatCount: hasCounts ? countOf(nextRow[sc + 1]) : 0,
        nominationCount: hasCounts ? countOf(nextRow[sc + 2]) : 0,
      });
    });
  }

  // Pass2: 名前未記入スロットを補完
  let resolved = 0;
  let unresolved = 0;
  const rawRows: Record<string, unknown>[] = [];
  slots.forEach((s) => {
    let name = s.name;
    let inferredName = false;
    if (!name) {
      if (!s.sales && !s.payment) return; // 名前も実績も無し
      // 同日同部屋の別番に「名前のみ (売上ゼロ)」があれば通し勤務とみなす
      const other = slots.find(
        (o) =>
          o.day === s.day &&
          o.block === s.block &&
          o.slot !== s.slot &&
          o.name &&
          !/ダミー/.test(o.name) &&
          !o.sales &&
          !o.payment,
      );
      if (other) {
        name = other.name;
        inferredName = true;
      }
      if (!name && kanri) {
        name = kanri[`${s.day}|${roomKeys[s.block]}|${s.slot}`] ?? "";
        if (name) inferredName = true;
      }
      if (name) resolved++;
      else {
        name = "(未記入)";
        unresolved++;
      }
    }
    if (/ダミー/.test(name) && !s.sales) return;
    const date = `${yearMonth}-${String(s.day).padStart(2, "0")}`;
    rawRows.push({
      date,
      store,
      therapist: name === "(未記入)" ? "" : name,
      sales: s.sales,
      payment: s.payment,
      _room: rooms[s.block] || "",
      _shift: s.slot,
      _inferredName: inferredName,
      _newCount: s.newCount,
      _repeatCount: s.repeatCount,
      _nominationCount: s.nominationCount,
    });
  });
  return { rawRows, resolved, unresolved };
}

// 売上シート (店舗日次合計) を store_daily の raw 行に変換
function parseSalesSheet(
  workbook: XLSX.WorkBook,
  sheetName: string,
  store: string,
): { rawRows: Record<string, unknown>[]; yearMonth: string | null } {
  const rows = gridOf(workbook, sheetName);
  let headerRow = -1;
  let dateCol = -1;
  for (let i = 0; i < Math.min(rows.length, 8); i++) {
    const j = (rows[i] ?? []).findIndex(
      (c) => typeof c === "string" && c.trim() === "日時",
    );
    if (j >= 0) {
      headerRow = i;
      dateCol = j;
      break;
    }
  }
  if (headerRow < 0) return { rawRows: [], yearMonth: null };
  // 日時からの相対列: +2実績 +3取り分 +10客単価 +11新規 +12顧客 +13指名
  const col = (k: number) => dateCol + k;
  const rawRows: Record<string, unknown>[] = [];
  let yearMonth: string | null = null;
  for (let i = headerRow + 1; i < rows.length; i++) {
    const row = rows[i] ?? [];
    const value = row[dateCol];
    const date =
      value instanceof Date && !Number.isNaN(value.getTime())
        ? `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`
        : null;
    if (!date) continue;
    if (!yearMonth) yearMonth = date.slice(0, 7);
    rawRows.push({
      date,
      store,
      sales: toNumber(row[col(2)]),
      payment: toNumber(row[col(3)]),
      _newCount: countOf(row[col(11)]),
      _repeatCount: countOf(row[col(12)]),
      _nominationCount: countOf(row[col(13)]),
    });
  }
  return { rawRows, yearMonth };
}

export function parseMonthlyWorkbook(
  bytes: ArrayBuffer,
  options: MonthlyParseOptions,
): ImportBatch | null {
  const fileHash = sha256(Buffer.from(bytes));
  const workbook = XLSX.read(bytes, {
    type: "array",
    cellDates: true,
    dense: false,
  });
  const pairs = detectMonthlyPairs(workbook);
  if (!pairs.length) return null;

  const batchId = randomUUID();
  const kanri = buildKanriIndex(workbook);
  const allRows: ImportRow[] = [];
  let rowNumber = 0;
  const sheetsUsed: string[] = [];

  for (const pair of pairs) {
    const sales = parseSalesSheet(workbook, pair.salesSheet, pair.store);
    if (sales.rawRows.length) sheetsUsed.push(pair.salesSheet);
    for (const raw of sales.rawRows) {
      rowNumber += 1;
      allRows.push(
        normalizeSalesRow({
          raw,
          rowNumber,
          classification: "store_daily",
          batchId,
          fileHash,
          sheetName: pair.salesSheet,
          targetYear: options.targetYear,
          fallbackStoreId: null,
          stores: options.stores,
          therapists: options.therapists,
        }),
      );
    }

    if (!pair.shiftSheet || !sales.yearMonth) continue;
    const shift = parseShiftSheet(
      workbook,
      pair.shiftSheet,
      sales.yearMonth,
      pair.store,
      kanri,
    );
    if (shift.rawRows.length) sheetsUsed.push(pair.shiftSheet);
    for (const raw of shift.rawRows) {
      rowNumber += 1;
      const row = normalizeSalesRow({
        raw,
        rowNumber,
        classification: "therapist_daily",
        batchId,
        fileHash,
        sheetName: pair.shiftSheet,
        targetYear: options.targetYear,
        fallbackStoreId: null,
        stores: options.stores,
        therapists: options.therapists,
      });
      if (raw._inferredName) {
        row.normalized.inferred_fields = [
          ...(row.normalized.inferred_fields ?? []),
          "therapist",
        ];
      }
      if (raw.therapist === "" || raw.therapist == null) {
        row.warnings.push("シフト表で名前が未記入です");
        row.review_required = true;
        row.normalized.review_required = true;
      }
      allRows.push(row);
    }
  }

  if (!allRows.length) return null;

  const accepted = allRows.filter(
    (r) => r.errors.length === 0 && !r.review_required,
  ).length;
  const warning = allRows.filter(
    (r) => r.errors.length === 0 && r.review_required,
  ).length;
  const rejected = allRows.filter((r) => r.errors.length > 0).length;
  const dates = allRows
    .map((r) => (r.normalized as { sales_date?: string }).sales_date)
    .filter((v): v is string => Boolean(v))
    .sort();

  return {
    id: batchId,
    file_name: options.fileName,
    file_hash: fileHash,
    store_id: null,
    source_sheet: sheetsUsed.join(", "),
    period_from: dates[0] ?? null,
    period_to: dates[dates.length - 1] ?? null,
    status: warning + rejected > 0 ? "review" : "parsed",
    total_rows: allRows.length,
    accepted_rows: accepted,
    rejected_rows: rejected,
    warning_rows: warning,
    uploaded_by: null,
    error_message: null,
    created_at: new Date().toISOString(),
    confirmed_at: null,
    rows: allRows,
  };
}
