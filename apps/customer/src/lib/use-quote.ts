"use client";
import { useEffect } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { formatMoney } from "@one/ui";
import { postQuote, qk } from "./api";
import { cartSignature, getCartStore, toCartLines, useCart } from "./cart-store";

/** Re-prices the cart server-side and folds issues/price changes back into the stored cart. */
export function useQuote(venueId: string, hydrated: boolean) {
  const lines = useCart(venueId, (s) => s.lines);
  const tableId = useCart(venueId, (s) => s.tableId);
  const signature = `${tableId ?? ""}#${cartSignature(lines)}`;

  const query = useQuery({
    queryKey: qk.quote(venueId, signature),
    queryFn: () => postQuote({ venueId, tableId: tableId!, lines: toCartLines(lines) }),
    enabled: hydrated && !!tableId && lines.length > 0,
    placeholderData: keepPreviousData,
    staleTime: 0,
  });

  const data = query.data;
  const isCurrent = !!data && !query.isPlaceholderData;

  useEffect(() => {
    if (!data || !isCurrent) return;
    const store = getCartStore(venueId);
    const st = store.getState();
    const messages: string[] = [];

    if (data.issues.length) {
      st.removeItems(data.issues.map((i) => i.menuItemId));
      for (const i of data.issues) messages.push(i.message);
    }
    for (const g of data.groups) {
      for (const ql of g.lines) {
        const cached = st.lines.find((l) => l.menuItemId === ql.menuItemId);
        if (!cached) continue;
        if (cached.priceMinor !== ql.unitPriceMinor) {
          messages.push(`${ql.name} is now ${formatMoney(ql.unitPriceMinor, data.currency)}.`);
          st.updateCached(ql.menuItemId, { priceMinor: ql.unitPriceMinor, name: ql.name });
        } else if (cached.name !== ql.name) {
          st.updateCached(ql.menuItemId, { name: ql.name });
        }
      }
    }
    if (messages.length) {
      const prev = store.getState().notice ?? [];
      st.setNotice([...new Set([...prev, ...messages])]);
    }
  }, [data, isCurrent, venueId]);

  return { ...query, isCurrent, tableId, lines };
}
