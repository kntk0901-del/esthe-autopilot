-- 掲載同意フラグの運用変更
--
-- 背景: 全従業員から契約時に掲載同意を取得済みであり、店舗の公開出勤ページに
-- 掲載されること自体が同意の表明である、という運用に合わせる。
-- これにより publication_consent は「投稿可否のゲート」としては廃止する。
-- アプリケーション側(lib/posting/therapist-selector.ts)は本フラグで投稿対象を
-- 絞り込まない。スクレイプで初出の名前もマスタへ自動登録のうえ投稿対象とする。
--
-- データ精度の安全策(時刻解析不能などの実データ異常)は shifts.review_required
-- で引き続き担保し、本マイグレーションでは変更しない。
--
-- 列自体は監査・表示用途のため残し、既定値を true、既存行も同意済みへ更新する。

alter table therapists
  alter column publication_consent set default true;

update therapists
  set publication_consent = true
  where publication_consent = false;
