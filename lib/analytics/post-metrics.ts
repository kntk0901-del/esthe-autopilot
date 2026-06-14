import { average } from "@/lib/utils";
import { sampleQuality } from "@/lib/analytics/sample-quality";
import type { AppData, VariantCode } from "@/lib/types";

export interface VariantMetrics {
  code: VariantCode;
  name: string;
  posts: number;
  averageImpressions: number;
  clicks: number;
  reservations: number;
  attributedSales: number;
  quality: ReturnType<typeof sampleQuality>;
  decisionEligible: boolean;
}

export function calculateVariantMetrics(data: AppData): VariantMetrics[] {
  return data.variants.map((variant) => {
    const posts = data.posts.filter(
      (post) => post.variant_id === variant.id && post.status === "posted",
    );
    const metrics = data.postMetrics.filter((metric) =>
      posts.some((post) => post.id === metric.post_id),
    );
    return {
      code: variant.code,
      name: variant.name,
      posts: posts.length,
      averageImpressions: average(
        metrics
          .map((metric) => metric.impressions)
          .filter((value): value is number => value !== null),
      ),
      clicks: data.clicks.filter(
        (click) =>
          click.counted && posts.some((post) => post.id === click.post_id),
      ).length,
      reservations: metrics.reduce(
        (sum, metric) => sum + (metric.reservations ?? 0),
        0,
      ),
      attributedSales: metrics.reduce(
        (sum, metric) => sum + (metric.attributed_sales ?? 0),
        0,
      ),
      quality: sampleQuality(posts.length),
      decisionEligible: posts.length >= 30,
    };
  });
}
