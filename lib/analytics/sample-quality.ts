export type SampleQuality = "サンプル不足" | "参考値" | "比較対象";

export function sampleQuality(count: number): SampleQuality {
  if (count < 10) return "サンプル不足";
  if (count < 30) return "参考値";
  return "比較対象";
}
