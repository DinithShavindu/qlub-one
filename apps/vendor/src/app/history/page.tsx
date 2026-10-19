import { redirect } from "next/navigation";

/** Old KDS link — today's history now lives under Orders. */
export default function HistoryRedirect() {
  redirect("/orders");
}
