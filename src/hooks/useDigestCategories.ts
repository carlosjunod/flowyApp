import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/lib/auth";
import { pb } from "@/lib/pb";

/** Digest exclusions match stored categories exactly, unlike search facets. */
export function useDigestCategories() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["digest-categories", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      if (!user?.id) return [];
      const rows = await pb
        .collection("items")
        .getFullList<{ category?: string }>({
          filter: pb.filter("user = {:user}", { user: user.id }),
          fields: "category",
          requestKey: null,
        });
      return [
        ...new Set(
          rows
            .map((row) => row.category)
            .filter((category): category is string => !!category?.trim()),
        ),
      ].sort((a, b) => a.localeCompare(b));
    },
  });
}
