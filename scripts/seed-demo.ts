import { getDemoStore } from "@/lib/db/demo-store";

const data = getDemoStore();
console.log(
  JSON.stringify(
    {
      stores: data.stores.length,
      therapists: data.therapists.length,
      shifts: data.shifts.length,
      salesRecords: data.salesRecords.length,
      posts: data.posts.length,
      jobs: data.jobs.length,
    },
    null,
    2,
  ),
);
