"use client";
import { AuthGate } from "@/components/AuthGate";
import { KdsBoard } from "@/components/kds/KdsBoard";

export default function KitchenPage() {
  return <AuthGate>{(me) => <KdsBoard me={me} />}</AuthGate>;
}
