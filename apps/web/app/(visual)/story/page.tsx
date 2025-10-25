import { notFound, redirect } from "next/navigation";

import { listStorySlugs } from "@/lib/stories";

export default async function StoryIndexPage() {
  const slugs = await listStorySlugs();
  if (slugs.length === 0) {
    notFound();
  }
  redirect(`/story/${slugs[0]}`);
}
