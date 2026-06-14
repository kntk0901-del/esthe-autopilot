import { createHash } from "node:crypto";

export function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

export function createPostContentHash(input: {
  storeId: string;
  postDate: string;
  variantCode: string;
  text: string;
  therapistIds: string[];
}): string {
  return sha256(
    [
      input.storeId,
      input.postDate,
      input.variantCode,
      input.text,
      [...input.therapistIds].sort().join(","),
    ].join("|"),
  );
}
