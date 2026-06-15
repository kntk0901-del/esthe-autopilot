// 汎用AI取込: 任意フォーマット(可変の売上表/日報/議事録/LINE報告 等)から
// 構造化レコードを抽出させるためのプロンプトを組み立てる純粋関数。
// node依存を持たないのでクライアント/サーバー両方から利用できる。

export interface AiSalesRecord {
  date: string | null;
  store: string | null;
  therapist: string | null;
  record_type?: "reservation" | "therapist_daily" | "store_daily";
  sales: number | null;
  payment?: number | null;
  course?: number | null;
  startTime?: string | null;
  customerType?: "新規" | "再来" | null;
  nomination?: "Y" | "N" | "不明" | null;
  source?: string | null;
}

export function buildExtractionPrompt(content: string, year: number): string {
  return `あなたはメンズエステ3店舗(ザ・リッツ蒲田 / スパラウンジ大井町 / 巣鴨店)の売上データを構造化するアシスタントです。
以下の「内容」は形式が一定ではありません(月次売上表・日報・個人別売上・議事録・LINE報告など)。読み取り、売上レコードの JSON 配列だけを出力してください。説明文・前置き・マークダウンは一切付けないでください。

各レコードの形式:
{
  "date": "YYYY-MM-DD",            // 年の記載が無ければ ${year} 年とみなす
  "store": "蒲田" | "大井町" | "巣鴨",  // 店舗名(表記ゆれは上記いずれかに正規化)
  "therapist": "氏名" または null,   // 個人別の行は氏名。店舗の日次合計行は null
  "record_type": "reservation" | "therapist_daily" | "store_daily",
  "sales": 数値,                   // 売上(実績)。円。カンマや¥は除く
  "payment": 数値 または null,      // セラピスト取り分
  "course": 数値 または null,       // コース分数
  "startTime": "HH:MM" または null,
  "customerType": "新規" | "再来" または null,
  "nomination": "Y" | "N" | "不明" または null,
  "source": "X" | "HP" | "LINE" 等 または null
}

ルール:
- 事実として読み取れる値だけを出力し、数値や名前を創作しない。不明は null。
- 1予約 = 1要素。1日1セラピストの集計なら record_type = "therapist_daily"。
- 店舗の日次合計(セラピスト不明で売上のみ)は record_type = "store_daily" とし therapist = null。
- 合計行・小計行・空行・見出し行は出力しない。
- 金額の "#DIV/0!" 等のエラー値や空欄は null。
- 出力は JSON 配列のみ(先頭は [ )。

--- 内容 ---
${content}`;
}
