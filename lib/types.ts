export type StoreCode = "kamata" | "oimachi" | "sugamo";
export type PostStatus =
  | "draft"
  | "scheduled"
  | "processing"
  | "posted"
  | "failed"
  | "cancelled";
export type ApprovalStatus = "auto" | "pending" | "approved" | "rejected";
export type JobStatus = "running" | "success" | "partial" | "failed" | "skipped";
export type ImportStatus =
  | "uploaded"
  | "parsed"
  | "review"
  | "confirmed"
  | "failed";
export type RecordType = "reservation" | "therapist_daily" | "store_daily";
export type RowClassification =
  | RecordType
  | "subtotal"
  | "total"
  | "empty"
  | "unknown";
export type VariantCode =
  | "schedule_info"
  | "therapist_focus"
  | "reservation_push"
  | "brand_message";
export type MeasurementMode = "operations_only" | "randomized_holdout";
export type SchedulerMode = "vercel_daily" | "qstash";
export type AccountHealthStatus =
  | "unknown"
  | "healthy"
  | "limited"
  | "suspended";
export type IntegrationSecretKey =
  | "geminiApiKey"
  | "xApiKey"
  | "xApiSecret"
  | "xAccessToken"
  | "xAccessTokenSecret"
  | "upstashRedisUrl"
  | "upstashRedisToken"
  | "qstashToken"
  | "qstashCurrentSigningKey"
  | "qstashNextSigningKey";

export interface StoreScraperConfig {
  dateTabSelector: string;
  dateIdPattern: string;
  cardSelector: string;
  nameSelector: string;
  timeSelector: string;
  imageSelector: string;
  profileLinkSelector: string;
  fallbackActiveTabSelector: string;
  timezone: string;
}

export interface Store {
  id: string;
  code: StoreCode;
  canonical_name: string;
  display_name: string;
  schedule_url: string | null;
  booking_url: string | null;
  x_account_name: string | null;
  monthly_target: number;
  room_capacity: number;
  enabled: boolean;
  auto_scrape_enabled: boolean;
  auto_post_enabled: boolean;
  scraper_config: StoreScraperConfig;
  posting_config: {
    postTime: string;
    includeUrlRate: number;
    maxTherapists: number;
    approvalRequired: boolean;
    hashtags: string[];
    imageAllowedDomains: string[];
    accountHealthStatus: AccountHealthStatus;
    blockWhenAccountRestricted: boolean;
    lastHealthCheckAt: string | null;
  };
  created_at: string;
  updated_at: string;
}

export interface Therapist {
  id: string;
  canonical_name: string;
  display_name: string;
  primary_store_id: string;
  aliases: string[];
  profile_url: string | null;
  profile_image_url: string | null;
  publication_consent: boolean;
  active: boolean;
  priority_flag: boolean;
  newcomer_flag: boolean;
  created_at: string;
  updated_at: string;
}

export interface Shift {
  id: string;
  store_id: string;
  therapist_id: string | null;
  therapist_raw: string;
  shift_date: string;
  start_time: string | null;
  end_time: string | null;
  source: string;
  source_url: string | null;
  source_key: string;
  confidence: number;
  review_required: boolean;
  inferred_fields: string[];
  missing_fields: string[];
  anomalies: string[];
  raw_payload: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface SalesRecord {
  id: string;
  batch_id: string | null;
  raw_id: string | null;
  record_type: RecordType;
  sales_date: string;
  store_id: string | null;
  therapist_id: string | null;
  therapist_raw: string | null;
  start_time: string | null;
  course_minutes: number | null;
  sales_amount: number;
  therapist_payment: number | null;
  gross_profit: number | null;
  discount: number | null;
  customer_type: "新規" | "再来" | null;
  nomination: "Y" | "N" | "不明" | null;
  source: string | null;
  status: "来店済" | "予約済" | "キャンセル" | null;
  confidence: number;
  review_required: boolean;
  inferred_fields: string[];
  missing_fields: string[];
  anomalies: string[];
  raw_payload: Record<string, unknown>;
  source_key: string;
  created_at: string;
  updated_at: string;
}

export interface PostVariant {
  id: string;
  code: VariantCode;
  name: string;
  description: string;
  prompt_template: string;
  fixed_template: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SocialPost {
  id: string;
  store_id: string;
  post_date: string;
  post_type: string;
  variant_id: string;
  status: PostStatus;
  approval_status: ApprovalStatus;
  scheduled_at: string | null;
  posted_at: string | null;
  text_content: string;
  fallback_text: string;
  used_ai: boolean;
  ai_model: string | null;
  ai_prompt: string | null;
  ai_raw_response: string | null;
  include_url: boolean;
  tracking_url: string | null;
  image_urls: string[];
  x_media_ids: string[];
  x_post_id: string | null;
  x_post_url: string | null;
  content_hash: string;
  attempt_count: number;
  last_error_code: string | null;
  last_error_message: string | null;
  therapist_ids: string[];
  control_therapist_ids: string[];
  measurement_mode: MeasurementMode;
  created_at: string;
  updated_at: string;
}

export interface TrackingClick {
  id: string;
  post_id: string;
  clicked_at: string;
  user_agent: string | null;
  referer: string | null;
  ip_hash: string | null;
  destination_url: string;
  is_bot: boolean;
  bot_reason: string | null;
  counted: boolean;
}

export interface PostMetric {
  id: string;
  post_id: string;
  measured_at: string;
  impressions: number | null;
  likes: number | null;
  reposts: number | null;
  replies: number | null;
  bookmarks: number | null;
  profile_clicks: number | null;
  link_clicks: number | null;
  reservations: number | null;
  attributed_sales: number | null;
  metric_source: string;
}

export interface JobRun {
  id: string;
  job_type: string;
  store_id: string | null;
  target_date: string | null;
  status: JobStatus;
  started_at: string;
  finished_at: string | null;
  processed_count: number;
  success_count: number;
  error_count: number;
  error_message: string | null;
  metadata: Record<string, unknown>;
}

export interface ImportRow {
  id: string;
  batch_id: string;
  row_number: number;
  classification: RowClassification;
  normalized: Partial<SalesRecord>;
  raw: Record<string, unknown>;
  confidence: number;
  review_required: boolean;
  errors: string[];
  warnings: string[];
}

export interface ImportBatch {
  id: string;
  file_name: string;
  file_hash: string;
  store_id: string | null;
  source_sheet: string | null;
  period_from: string | null;
  period_to: string | null;
  status: ImportStatus;
  total_rows: number;
  accepted_rows: number;
  rejected_rows: number;
  warning_rows: number;
  uploaded_by: string | null;
  error_message: string | null;
  created_at: string;
  confirmed_at: string | null;
  rows: ImportRow[];
}

export interface SystemSettings {
  id: "default";
  measurementMode: MeasurementMode;
  schedulerMode: SchedulerMode;
  appBaseUrl: string;
  postingEnabled: boolean;
  dailyPostLimit: number;
  monthlyXBudgetYen: number;
  estimatedXCostPerPostYen: number;
  useGemini: boolean;
  geminiModel: string;
  xMockMode: boolean;
  xApiBaseUrl: string;
  xUploadBaseUrl: string;
  botFilterEnabled: boolean;
  botUserAgentPatterns: string[];
  reachMonitoringEnabled: boolean;
  minimumImpressionsAfter24h: number;
  grossProfitIsEstimate: boolean;
  defaultTherapistPaymentRate: number;
  updated_at: string;
}

export type SecretStatus = Record<IntegrationSecretKey, boolean>;

export interface AppData {
  stores: Store[];
  therapists: Therapist[];
  shifts: Shift[];
  salesRecords: SalesRecord[];
  variants: PostVariant[];
  posts: SocialPost[];
  clicks: TrackingClick[];
  postMetrics: PostMetric[];
  jobs: JobRun[];
  imports: ImportBatch[];
  systemSettings: SystemSettings;
}
