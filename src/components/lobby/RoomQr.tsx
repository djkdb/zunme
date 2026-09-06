"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

/** QR of the invite link so friends in the same room can scan instead of typing the code. */
export function RoomQr({ url, size = 128 }: { url: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    QRCode.toDataURL(url, { margin: 1, width: size * 2, color: { dark: "#12142b", light: "#ffffff" } })
      .then((data) => {
        if (alive) setSrc(data);
      })
      .catch(() => {
        if (alive) setSrc(null);
      });
    return () => {
      alive = false;
    };
  }, [url, size]);
  if (!src) return <div className="rounded-xl bg-white/10" style={{ width: size, height: size }} />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="초대 QR" width={size} height={size} className="rounded-xl bg-white p-1" />;
}
