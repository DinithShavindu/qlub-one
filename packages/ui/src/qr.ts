import QRCode from "qrcode";

const OPTS = { margin: 1, errorCorrectionLevel: "M" as const, color: { dark: "#12161F", light: "#FFFFFF" } };

/** SVG markup for a table QR — same look as QrCard. */
export function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, { ...OPTS, type: "svg" });
}

/** PNG data URL for a table QR, sized for print. */
export function qrPngDataUrl(url: string, width = 1024): Promise<string> {
  return QRCode.toDataURL(url, { ...OPTS, width });
}
