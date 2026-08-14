import { createHmac } from "node:crypto";
import OAuth from "oauth-1.0a";
import { AppError, describeError } from "@/lib/errors/app-error";
import type { SocialPost, Store } from "@/lib/types";
import type { SystemSettings } from "@/lib/types";
import { getSecretValueForStore } from "@/lib/settings/secrets";

export interface PublishResult {
  postId: string;
  postUrl: string;
  mediaIds: string[];
}

/**
 * 資格情報に空白・改行・全角文字が混入していると、OAuthヘッダが不正になり
 * fetch が `TypeError: fetch failed` で落ちる(過去に env 貼り付けで再発)。
 * 原因不明のまま落ちるのを防ぐため、送信前に検出して明示的に知らせる。
 */
function assertCleanSecret<T extends string | null | undefined>(
  label: string,
  value: T,
): T {
  if (typeof value === "string" && value !== "" && /[^\x21-\x7e]/.test(value)) {
    throw new AppError(
      "X_AUTH_FAILED",
      `${label} に空白・改行・全角などの不正文字が含まれています。値をクリーンに再設定してください`,
    );
  }
  return value;
}

async function credentials(storeCode: string) {
  return {
    apiKey: assertCleanSecret(
      "X API Key",
      await getSecretValueForStore("xApiKey", storeCode),
    ),
    apiSecret: assertCleanSecret(
      "X API Secret",
      await getSecretValueForStore("xApiSecret", storeCode),
    ),
    accessToken: assertCleanSecret(
      "X Access Token",
      await getSecretValueForStore("xAccessToken", storeCode),
    ),
    accessTokenSecret: assertCleanSecret(
      "X Access Token Secret",
      await getSecretValueForStore("xAccessTokenSecret", storeCode),
    ),
  };
}

async function createOAuthClient(storeCode: string): Promise<OAuth> {
  const auth = await credentials(storeCode);
  if (!auth.apiKey || !auth.apiSecret) {
    throw new AppError("X_AUTH_FAILED", "X API keyが未設定です");
  }
  return new OAuth({
    consumer: { key: auth.apiKey, secret: auth.apiSecret },
    signature_method: "HMAC-SHA1",
    hash_function(baseString, key) {
      return createHmac("sha1", key).update(baseString).digest("base64");
    },
  });
}

async function token(
  storeCode: string,
): Promise<{ key: string; secret: string }> {
  const auth = await credentials(storeCode);
  if (!auth.accessToken || !auth.accessTokenSecret) {
    throw new AppError("X_AUTH_FAILED", "X access tokenが未設定です");
  }
  return { key: auth.accessToken, secret: auth.accessTokenSecret };
}

async function signedFetch(
  url: string,
  init: RequestInit & { method: string },
  storeCode: string,
): Promise<Response> {
  const oauth = await createOAuthClient(storeCode);
  const requestData = { url, method: init.method };
  const headers = oauth.toHeader(
    oauth.authorize(requestData, await token(storeCode)),
  );
  try {
    return await fetch(url, {
      ...init,
      headers: { ...headers, ...init.headers },
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    // ここに来るのはHTTPエラーではなくネットワーク層の失敗(DNS/TLS/タイムアウト/不正ヘッダ)。
    // 規約違反による拒否ではないため、原因を展開して区別できるようにする。
    throw new AppError(
      "X_POST_FAILED",
      `X APIへの接続に失敗しました (${init.method} ${url}): ${describeError(error)}`,
    );
  }
}

function validateImageUrl(url: string, store: Store): void {
  const parsed = new URL(url);
  const allowed = store.posting_config.imageAllowedDomains;
  if (
    parsed.protocol !== "https:" ||
    !allowed.some(
      (domain) => parsed.hostname === domain || parsed.hostname.endsWith(`.${domain}`),
    )
  ) {
    throw new AppError("IMAGE_FETCH_FAILED", "画像URLが許可ドメイン外です");
  }
}

async function uploadMedia(
  url: string,
  store: Store,
  settings: SystemSettings,
): Promise<string> {
  validateImageUrl(url, store);
  const image = await fetch(url, {
    signal: AbortSignal.timeout(15_000),
    cache: "no-store",
  });
  const mime = image.headers.get("content-type") ?? "";
  const length = Number(image.headers.get("content-length") ?? 0);
  if (!image.ok || !["image/jpeg", "image/png", "image/webp"].includes(mime)) {
    throw new AppError("IMAGE_FETCH_FAILED", "画像形式が不正です");
  }
  if (length > 5 * 1024 * 1024) {
    throw new AppError("IMAGE_FETCH_FAILED", "画像サイズが5MBを超えています");
  }
  const bytes = await image.arrayBuffer();
  if (bytes.byteLength > 5 * 1024 * 1024) {
    throw new AppError("IMAGE_FETCH_FAILED", "画像サイズが5MBを超えています");
  }
  const form = new FormData();
  form.append("media", new Blob([bytes], { type: mime }), "image");
  const response = await signedFetch(
    `${settings.xUploadBaseUrl}/1.1/media/upload.json`,
    { method: "POST", body: form },
    store.code,
  );
  if (!response.ok) {
    throw new AppError(
      "X_MEDIA_UPLOAD_FAILED",
      `media upload HTTP ${response.status}`,
    );
  }
  const json = (await response.json()) as { media_id_string?: string };
  if (!json.media_id_string) {
    throw new AppError("X_MEDIA_UPLOAD_FAILED");
  }
  return json.media_id_string;
}

async function createXPost(
  text: string,
  mediaIds: string[],
  settings: SystemSettings,
  storeCode: string,
): Promise<{ id: string }> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await signedFetch(
      `${settings.xApiBaseUrl}/2/tweets`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          text,
          ...(mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}),
        }),
      },
      storeCode,
    );
    if (response.ok) {
      const json = (await response.json()) as { data?: { id?: string } };
      if (json.data?.id) return { id: json.data.id };
    }
    lastError = `HTTP ${response.status}: ${await response.text()}`;
    if ([401, 403].includes(response.status)) {
      throw new AppError("X_AUTH_FAILED", lastError);
    }
    if (response.status === 429) {
      const retryAfter = Number(response.headers.get("retry-after") ?? 1);
      await new Promise((resolve) =>
        setTimeout(resolve, Math.min(retryAfter, 10) * 1000),
      );
    } else if (response.status >= 500) {
      await new Promise((resolve) =>
        setTimeout(resolve, 500 * 2 ** attempt),
      );
    } else {
      break;
    }
  }
  throw new AppError("X_POST_FAILED", lastError || undefined);
}

export async function publishToX(
  post: SocialPost,
  store: Store,
  settings: SystemSettings,
): Promise<PublishResult> {
  // 送信直前の最終ゲート。planner で生成済みの既存postが image_urls を
  // 保持していても、店舗設定が false なら画像は一切添付しない。
  const targetImageUrls = store.posting_config.includeImages
    ? post.image_urls
    : [];
  if (settings.xMockMode) {
    const postId = `mock-${Date.now()}`;
    return {
      postId,
      postUrl: `https://x.com/${store.x_account_name?.replace("@", "") ?? "demo"}/status/${postId}`,
      mediaIds: targetImageUrls.map((_, index) => `mock-media-${index + 1}`),
    };
  }
  const mediaIds: string[] = [];
  for (const url of targetImageUrls.slice(0, 4)) {
    try {
      mediaIds.push(await uploadMedia(url, store, settings));
    } catch {
      // Image failures intentionally degrade to fewer images or text-only.
    }
  }
  const result = await createXPost(
    post.text_content,
    mediaIds,
    settings,
    store.code,
  );
  return {
    postId: result.id,
    postUrl: `https://x.com/${store.x_account_name?.replace("@", "") ?? "i"}/status/${result.id}`,
    mediaIds,
  };
}
