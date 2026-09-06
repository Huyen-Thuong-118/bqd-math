import { SearchResultsPage } from "@/features/search/components/SearchResultsPage";
import { parseSearchFilters } from "@/features/search/filters";
import { getSearchResults } from "@/features/search/queries";

export const dynamic = "force-dynamic";

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const filters = parseSearchFilters(await searchParams);
  const data = await getSearchResults(filters);
  return <SearchResultsPage data={data} filters={filters} />;
}
