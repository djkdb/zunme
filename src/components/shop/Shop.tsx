"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CharacterPreview } from "@/components/shop/CharacterPreview";
import { sound } from "@/game/audio";
import { ITEMS, SLOT_LABELS, itemById, type CosmeticSlot } from "@/game/items";
import { useGameStore } from "@/store/gameStore";
import { useWalletStore } from "@/store/walletStore";

const SLOTS: CosmeticSlot[] = ["hat", "face", "back", "trail"];

/** Points shop: buy and equip cosmetics for the ZUN character. */
export function Shop({ onClose }: { onClose: () => void }) {
  const points = useWalletStore((s) => s.points);
  const owned = useWalletStore((s) => s.owned);
  const equipped = useWalletStore((s) => s.equipped);
  const lifetime = useWalletStore((s) => s.lifetime);
  const buy = useWalletStore((s) => s.buy);
  const equip = useWalletStore((s) => s.equip);
  const setCosmetics = useGameStore((s) => s.setCosmetics);
  const [slot, setSlot] = useState<CosmeticSlot>("hat");
  const [flash, setFlash] = useState<string | null>(null);

  const items = ITEMS.filter((i) => i.slot === slot);
  const previewColor = "#3d8bff";

  const onBuy = (id: string) => {
    if (buy(id)) {
      sound.play("win", { volume: 0.5 });
      equip(id);
      setCosmetics(useWalletStore.getState().equipped);
      setFlash(`Bought ${itemById(id)?.name}!`);
    } else {
      sound.play("click");
      setFlash("Not enough points — play a round!");
    }
    setTimeout(() => setFlash(null), 1600);
  };
  const onEquip = (id: string) => {
    sound.play("click");
    equip(id);
    setCosmetics(useWalletStore.getState().equipped);
  };

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-[#12142b]/70 p-3 backdrop-blur-sm safe-pad" onClick={onClose}>
      <div className="panel anim-pop flex max-h-full w-full max-w-3xl flex-col overflow-hidden p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="display text-2xl text-white sm:text-3xl">ZUN SHOP</div>
            <div className="text-[10px] font-bold tracking-[0.3em] text-white/50">COSMETICS ONLY · NO ADVANTAGES</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="chip px-3 py-1.5 text-right">
              <div className="text-[9px] font-bold tracking-[0.3em] text-white/50">POINTS</div>
              <div className="display text-xl text-brand-2">⭐ {points}</div>
            </div>
            <button className="chip flex h-10 w-10 items-center justify-center text-lg text-white" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </div>
        </div>

        <div className="mt-3 flex min-h-0 flex-1 gap-3">
          {/* preview */}
          <div className="hidden w-40 shrink-0 flex-col rounded-2xl bg-white/5 sm:flex">
            <div className="relative h-48 w-full">
              <CharacterPreview cosmetics={equipped} colorHex={previewColor} />
            </div>
            <div className="px-2 pb-2 text-center text-[10px] font-bold tracking-widest text-white/50">LIFETIME {lifetime} PTS</div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex gap-1.5">
              {SLOTS.map((s) => (
                <button
                  key={s}
                  className={`rounded-xl px-3 py-1.5 text-[11px] font-black tracking-widest ${slot === s ? "bg-brand-2 text-[#12142b]" : "bg-white/10 text-white/80"}`}
                  onClick={() => {
                    sound.play("click");
                    setSlot(s);
                  }}
                >
                  {SLOT_LABELS[s]}
                </button>
              ))}
            </div>
            <div className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto pr-1 sm:grid-cols-3">
              {items.map((item) => {
                const isOwned = owned.includes(item.id);
                const isEquipped = equipped[item.slot] === item.id;
                const affordable = points >= item.price;
                return (
                  <div key={item.id} className={`flex flex-col rounded-2xl border-2 p-2.5 ${isEquipped ? "border-brand-2 bg-brand-2/10" : "border-white/10 bg-white/5"}`}>
                    <div className="flex items-center gap-2">
                      <div className="text-2xl">{item.emoji}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">{item.name}</div>
                        <div className="text-[10px] font-semibold leading-tight text-white/55">{item.description}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      {isEquipped ? (
                        <div className="rounded-xl bg-brand-2/20 py-1.5 text-center text-[11px] font-black tracking-widest text-brand-2">EQUIPPED</div>
                      ) : isOwned ? (
                        <button className="w-full rounded-xl bg-white py-1.5 text-[11px] font-black tracking-widest text-[#12142b] active:scale-95" onClick={() => onEquip(item.id)}>
                          EQUIP
                        </button>
                      ) : (
                        <button
                          className={`w-full rounded-xl py-1.5 text-[11px] font-black tracking-widest active:scale-95 ${affordable ? "bg-brand text-white" : "bg-white/10 text-white/40"}`}
                          onClick={() => onBuy(item.id)}
                        >
                          BUY · ⭐ {item.price}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-2 flex h-5 items-center justify-between text-[11px] font-bold text-white/60">
          <span>{flash ?? "Win rounds to earn points: 1st +120 · 2nd +90 · 3rd +70 · others +50"}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
