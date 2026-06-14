import { readFileSync } from "node:fs";
import { getDemoStore } from "@/lib/db/demo-store";
import { parseWorkbook } from "@/lib/import/workbook-parser";

const data = getDemoStore();
const bytes = readFileSync("tests/fixtures/sales-normal.csv");
const batch = parseWorkbook(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
  {
    fileName: "sales-normal.csv",
    storeId: null,
    targetYear: 2026,
    stores: data.stores,
    therapists: data.therapists,
  },
);
console.log(JSON.stringify(batch, null, 2));
