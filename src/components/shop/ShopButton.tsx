"use client";

import { useState } from "react";
import { Shop, type ShopTab } from "@/components/shop/Shop";
import { sound } from "@/game/audio";
import { useWalletStore } from "@/store/walletStore";

/** Points chip that opens the shop. */
export function ShopButton({ compact = false, tab = "shop" }: { compact?: boolean; tab?: ShopTab }) {
  const points = useWalletStore((s) => s.points);
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        className="chip pointer-events-auto flex h-11 items-center gap-2 px-3 text-sm font-black text-white active:scale-95"
        onClick={() => {
          sound.unlock();
          sound.play("click");
          setOpen(true);
        }}
      >
        {tab === "records" ? (
          <>
            <span>📊</span>
            {!compact && <span className="tracking-widest">내 기록</span>}
          </>
        ) : (
          <>
            <span>🛍️</span>
            {!compact && <span className="tracking-widest">상점</span>}
            <span className="text-brand-2">⭐ {points}</span>
          </>
        )}
      </button>
      {open && <Shop onClose={() => setOpen(false)} initialTab={tab} />}
    </>
  );
}
