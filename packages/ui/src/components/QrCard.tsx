"use client";
import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { cn } from "../utils";

export function QrCard({
  venueName,
  tableLabel,
  url,
  className,
}: {
  venueName: string;
  tableLabel: string;
  url: string;
  className?: string;
}) {
  const [svg, setSvg] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toString(url, { type: "svg", margin: 1, errorCorrectionLevel: "M", color: { dark: "#12161F", light: "#FFFFFF" } })
      .then((s) => alive && setSvg(s))
      .catch(() => alive && setSvg(null));
    return () => {
      alive = false;
    };
  }, [url]);
  return (
    <figure className={cn("flex break-inside-avoid flex-col items-center gap-2 rounded-lg border border-line bg-white p-4 text-[#12161F]", className)}>
      <div className="aspect-square w-full max-w-[180px]" aria-label={`QR code for ${tableLabel}`} role="img">
        {svg ? <div className="h-full w-full [&>svg]:h-full [&>svg]:w-full" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="h-full w-full animate-pulse rounded-md bg-[#ECE8DF]" />}
      </div>
      <figcaption className="text-center">
        <p className="font-display text-h2 font-bold">{tableLabel}</p>
        <p className="text-small">{venueName}</p>
        <p className="mt-1 break-all text-micro text-[#6B7280]">{url}</p>
      </figcaption>
    </figure>
  );
}
