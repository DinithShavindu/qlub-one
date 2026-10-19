"use client";
import { KdsBoard } from "@/components/kds/KdsBoard";
import { usePanel } from "@/lib/panel";

export default function QsrOrdersPage() {
  const { me } = usePanel();
  return <KdsBoard me={me} />;
}
