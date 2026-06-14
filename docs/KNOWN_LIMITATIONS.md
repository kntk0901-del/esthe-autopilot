# 既知の制約

1. 蒲田のselectorは設計書の設定値を初期値にしています。実サイトDOM、利用規約、robots、HTMLサイズ、通常件数を運用前に確認してください。
2. 大井町は `https://esthe-spa-lounge.com/schedule/` の2026年6月14日DOMで実地確認済みです。サイト改修時は設定画面の取得テストとselector更新が必要です。巣鴨はURLとselectorが未確定です。
3. モックデータはNode.jsプロセス内に保持され、再起動やServerless instance切替で初期化されます。
4. Supabase実接続の負荷・RLS・OTP配信はプロジェクト環境での結合試験が必要です。
5. X APIの利用可能endpoint、media upload、投稿上限、料金は契約プランに依存します。
6. `xlsx@0.18.5` のnpm版には既知advisoryがあります。管理者限定・5MB上限で緩和していますが、本番前の置換を推奨します。
7. 画像は5MB以下のJPEG / PNG / WebPに限定し、店舗設定の許可ドメインだけを取得します。GIFと動画は対象外です。
8. X文字数はUnicode code point数で検証しています。Xの厳密なweighted lengthとの差があり得ます。
9. 売上帰属は直接流入または手動値であり、掲載と売上の因果関係は証明しません。
10. Excel解析はメモリ上で行います。PoC上限は5MBで、大規模ファイルのstreaming処理は未実装です。
11. アラートWebhookの環境変数は用意していますが、送信アダプターはPoCの管理画面ログを優先し未接続です。
12. E2Eはモックモードを対象とし、実Supabase、Upstash、Gemini、Xの結合試験は各環境で実施します。
13. Vercel日次Cronは09:00 JST固定です。店舗別の設定時刻を反映する場合はQStashモードを使用します。
