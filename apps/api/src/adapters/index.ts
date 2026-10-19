import type { Vendor } from "@one/contracts";
import { mockPosAdapter } from "./mock-pos";
import { tabletAdapter } from "./tablet";
import type { PosAdapter } from "./types";

export * from "./types";
export { mockPosAdapter, tabletAdapter };

export function adapterFor(vendor: Pick<Vendor, "posMode">): PosAdapter {
  return vendor.posMode === "mock_pos" ? mockPosAdapter : tabletAdapter;
}
