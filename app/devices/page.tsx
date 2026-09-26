import { permanentRedirect } from "next/navigation";

// Devices was renamed Setup (docs/specs/finished/page-structure.md). Keep `?mac=` and any other query.
export default async function DevicesPage({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    for (const item of Array.isArray(value) ? value : value === undefined ? [] : [value]) {
      params.append(key, item);
    }
  }
  const query = params.toString();
  permanentRedirect(query ? `/setup?${query}` : "/setup");
}
