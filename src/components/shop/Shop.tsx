"use client";

import { useState } from "react";
import { createPortal } from "react-dom";
import { CharacterPreview } from "@/components/shop/CharacterPreview";
import { BadgesPanel, LevelBar, MissionsPanel, RecordsPanel } from "@/components/shop/ProgressPanels";
import { levelFromXp } from "@/game/progression";
import { useProgressStore } from "@/store/progressStore";
import { sound } from "@/game/audio";
import { ITEMS, RARITY_LABELS, SLOT_LABELS, itemById, rarityOf, type CosmeticSlot } from "@/game/items";
import { useGameStore } from "@/store/gameStore";
import { useWalletStore } from "@/store/walletStore";

const SLOTS: CosmeticSlot[] = ["hat", "face", "back", "trail"];
export type ShopTab = "shop" | "missions" | "badges" | "records";
type Tab = ShopTab;

/** Points shop: buy and equip cosmetics for the ZUN character. */
export function Shop({ onClose, initialTab = "shop" }: { onClose: () => void; initialTab?: ShopTab }) {
  const points = useWalletStore((s) => s.points);
  const owned = useWalletStore((s) => s.owned);
  const equipped = useWalletStore((s) => s.equipped);
  const lifetime = useWalletStore((s) => s.lifetime);
  const buy = useWalletStore((s) => s.buy);
  const equip = useWalletStore((s) => s.equip);
  const setCosmetics = useGameStore((s) => s.setCosmetics);
  const [slot, setSlot] = useState<CosmeticSlot>("hat");
  const [tab, setTab] = useState<Tab>(initialTab);
  const [flash, setFlash] = useState<string | null>(null);
  const xp = useProgressStore((s) => s.xp);
  const level = levelFromXp(xp).level;

  const items = ITEMS.filter((i) => i.slot === slot);
  const previewColor = "#3d8bff";

  const onBuy = (id: string) => {
    const item = itemById(id);
    if (item?.minLevel && level < item.minLevel) {
      sound.play("click");
      setFlash(`${item.name}은(는) 레벨 ${item.minLevel}에 해금돼요`);
      setTimeout(() => setFlash(null), 1600);
      return;
    }
    if (buy(id)) {
      sound.play("win", { volume: 0.5 });
      equip(id);
      setCosmetics(useWalletStore.getState().equipped);
      setFlash(`${itemById(id)?.name} 구매 완료!`);
    } else {
      sound.play("click");
      setFlash("포인트가 부족해요 — 한 판 더!");
    }
    setTimeout(() => setFlash(null), 1600);
  };
  const onEquip = (id: string) => {
    sound.play("click");
    equip(id);
    setCosmetics(useWalletStore.getState().equipped);
  };
  /** Random outfit from what the player owns (every slot at once). */
  const shuffle = () => {
    sound.play("emote", { volume: 0.5 });
    for (const s of SLOTS) {
      const pool = ITEMS.filter((i) => i.slot === s && owned.includes(i.id));
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) equip(pick.id);
    }
    setCosmetics(useWalletStore.getState().equipped);
    setFlash("랜덤 코디 완료!");
    setTimeout(() => setFlash(null), 1200);
  };
  const ownedCount = ITEMS.filter((i) => owned.includes(i.id)).length;

  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[60] flex items-center justify-center bg-[#12142b]/70 p-3 backdrop-blur-sm safe-pad" onClick={onClose}>
      <div className="panel anim-rise flex max-h-full w-full max-w-3xl flex-col overflow-hidden p-4 sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div>
              <div className="display text-2xl text-white sm:text-3xl">ZUN 상점</div>
              <div className="text-[10px] font-bold tracking-[0.3em] text-white/50">치장 전용 · 능력치 변화 없음</div>
            </div>
            <div className="hidden sm:block">
              <LevelBar />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="chip px-3 py-1.5 text-right">
              <div className="text-[9px] font-bold tracking-[0.3em] text-white/50">포인트</div>
              <div className="display text-xl text-brand-2">⭐ {points}</div>
            </div>
            <button className="chip flex h-10 w-10 items-center justify-center text-lg text-white" onClick={onClose} aria-label="닫기">
              ✕
            </button>
          </div>
        </div>

        <div className="mt-3 flex gap-1.5">
          {(["shop", "missions", "badges", "records"] as Tab[]).map((t) => (
            <button
              key={t}
              className={`rounded-xl px-3 py-1.5 text-[11px] font-black tracking-widest ${tab === t ? "bg-white text-[#12142b]" : "bg-white/10 text-white/80"}`}
              onClick={() => {
                sound.play("click");
                setTab(t);
              }}
            >
              {t === "shop" ? "🛍️ 상점" : t === "missions" ? "🎯 미션" : t === "badges" ? "🎖️ 배지" : "📊 기록"}
            </button>
          ))}
          <div className="ml-auto sm:hidden">
            <LevelBar compact />
          </div>
        </div>

        {tab === "missions" && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <MissionsPanel />
          </div>
        )}
        {tab === "badges" && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <BadgesPanel />
          </div>
        )}
        {tab === "records" && (
          <div className="mt-3 flex min-h-0 flex-1 flex-col">
            <RecordsPanel />
          </div>
        )}

        <div className={`mt-3 flex min-h-0 flex-1 gap-3 ${tab === "shop" ? "" : "hidden"}`}>
          {/* preview */}
          <div className="hidden w-40 shrink-0 flex-col rounded-2xl bg-white/5 sm:flex">
            <div className="relative h-48 w-full">
              <CharacterPreview cosmetics={equipped} colorHex={previewColor} />
            </div>
            <div className="px-2 pb-2 text-center text-[10px] font-bold tracking-widest text-white/50">누적 {lifetime} 포인트</div>
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
              <button className="ml-auto rounded-xl bg-white/10 px-2.5 py-1.5 text-[11px] font-black tracking-widest text-white/80 active:scale-95" onClick={shuffle} title="가진 아이템으로 랜덤 코디">
                🎲 <span className="hidden sm:inline">랜덤 코디</span> <span className="text-white/40">{ownedCount}/{ITEMS.length}</span>
              </button>
            </div>
            <div className="mt-2 grid min-h-0 flex-1 grid-cols-2 gap-2 overflow-y-auto scroll-y pr-1 sm:grid-cols-3">
              {items.map((item) => {
                const isOwned = owned.includes(item.id);
                const isEquipped = equipped[item.slot] === item.id;
                const locked = Boolean(item.minLevel && level < item.minLevel);
                const affordable = points >= item.price && !locked;
                const rarity = RARITY_LABELS[rarityOf(item)];
                return (
                  <div key={item.id} className={`relative flex flex-col rounded-2xl border-2 p-2.5 ${isEquipped ? "border-brand-2 bg-brand-2/10" : "border-white/10 bg-white/5"}`}>
                    {item.price > 0 && (
                      <span className="absolute right-2 top-2 flex gap-1 text-[8px] font-black tracking-widest">
                        {item.isNew && !isOwned && <span className="rounded-full bg-brand px-1.5 text-white">NEW</span>}
                        <span className="rounded-full px-1.5" style={{ background: `${rarity.color}33`, color: rarity.color }}>
                          {rarity.name}
                        </span>
                      </span>
                    )}
                    <div className="flex items-center gap-2">
                      <div className="text-2xl">{item.emoji}</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">{item.name}</div>
                        <div className="text-[10px] font-semibold leading-tight text-white/55">{item.description}</div>
                      </div>
                    </div>
                    <div className="mt-2">
                      {isEquipped ? (
                        <div className="rounded-xl bg-brand-2/20 py-1.5 text-center text-[11px] font-black tracking-widest text-brand-2">장착 중</div>
                      ) : isOwned ? (
                        <button className="w-full rounded-xl bg-white py-1.5 text-[11px] font-black tracking-widest text-[#12142b] active:scale-95" onClick={() => onEquip(item.id)}>
                          장착
                        </button>
                      ) : (
                        <button
                          className={`w-full rounded-xl py-1.5 text-[11px] font-black tracking-widest active:scale-95 ${affordable ? "bg-brand text-white" : "bg-white/10 text-white/40"}`}
                          onClick={() => onBuy(item.id)}
                        >
                          {locked ? `🔒 Lv.${item.minLevel}` : `구매 · ⭐ ${item.price}`}
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
          <span>{flash ?? "포인트는 순위, 생존, 체크포인트, 연승, 미션, 배지로 얻어요. 포인트 = 경험치."}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
