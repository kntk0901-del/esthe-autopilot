import { createHmac } from "node:crypto";
import OAuth from "oauth-1.0a";
import { AppError } from "@/lib/errors/app-error";
import type { SocialPost, Store } from "@/lib/types";
import type { SystemSettings } from "@/lib/types";
import { getSecretValue } from "@/lib/settings/secrets";

export interface PublishResult {
  postId: string;
  postUrl: string;
  mediaIds: string[];
}

async function credentials() {
  return {
    apiKey: await getSecretValue("xApiKey"),
    apiSecret: await getSecretValue("xApiSecret"),
    accessToken: await getSecretValue("xAccessToken"),
    accessTokenSecret: await getSecretValue("xAccessTokenSecret"),
  };
}

async function createOAuthClient(): Promise<OAuth> {
  const auth = await credentials();
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

async function token(): Promise<{ key: string; secret: string }> {
  const auth = await credentials();
  if (!auth.accessToken || !auth.accessTokenSecret) {
    throw new AppError("X_AUTH_FAILED", "X access tokenが未設定です");
  }
  return { key: auth.accessToken, secret: auth.accessTokenSecret };
}

async function signedFetch(
  url: string,
  init: RequestInit & { method: string },
): Promise<Response> {
  const oauth = await createOAuthClient();
  const requestData = { url, method: init.method };
  const headers = oauth.toHeader(oauth.authorize(requestData, await token()));
  return fetch(url, {
    ...init,
    headers: { ...headers, ...init.headers },
    signal: AbortSignal.timeout(20_000),
  });
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
): Promise<{ id: string }> {
  let lastError = "";
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const response = await signedFetch(`${settings.xApiBaseUrl}/2/tweets`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text,
        ...(mediaIds.length > 0 ? { media: { media_ids: mediaIds } } : {}),
      }),
    });
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
  if (settings.xMockMode) {
    const postId = `mock-${Date.now()}`;
    return {
      postId,
      postUrl: `https://x.com/${store.x_account_name?.replace("@", "") ?? "demo"}/status/${postId}`,
      mediaIds: post.image_urls.map((_, index) => `mock-media-${index + 1}`),
    };
  }
  const mediaIds: string[] = [];
  for (const url of post.image_urls.slice(0, 4)) {
    try {
      mediaIds.push(await uploadMedia(url, store, settings));
    } catch {
      // Image failures intentionally degrade to fewer images or text-only.
    }
  }
  const result = await createXPost(post.text_content, mediaIds, settings);
  return {
    postId: result.id,
    postUrl: `https://x.com/${store.x_account_name?.replace("@", "") ?? "i"}/status/${result.id}`,
    mediaIds,
  };
}
