import type { Store, Therapist } from "@/lib/types";

export function createMockScheduleHtml(
  store: Store,
  date: string,
  therapists: Therapist[],
): string {
  const members = therapists
    .filter((therapist) => therapist.primary_store_id === store.id)
    .slice(0, 4);
  return `
    <!doctype html>
    <html lang="ja">
      <body>
        <section id="tlsp-${date}" class="is-active">
          ${members
            .map(
              (therapist, index) => `
                <article class="tl-schedule-card">
                  <a href="${therapist.profile_url ?? "#"}">
                    ${
                      therapist.profile_image_url
                        ? `<img src="${therapist.profile_image_url}" alt="">`
                        : ""
                    }
                    <h3 class="therapist-name">${therapist.display_name}</h3>
                    <p class="schedule-time">${11 + index * 2}:00 〜 ${
                      19 + index * 2
                    }:00</p>
                  </a>
                </article>
              `,
            )
            .join("")}
        </section>
      </body>
    </html>
  `;
}
