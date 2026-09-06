import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE_DESCRIPTION, SITE_NAME } from "@/lib/site";
import { RoomViewLoader } from "@/components/lobby/RoomViewLoader";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room";

/** Invite links unfurl as "방 ABC123에 초대" cards in chat apps. */
export async function generateMetadata({ params }: { params: Promise<{ code: string }> }): Promise<Metadata> {
  const { code } = await params;
  const normalized = normalizeRoomCode(decodeURIComponent(code));
  if (!isValidRoomCode(normalized)) return {};
  const title = `ZUUUN 방 ${normalized}에 초대받았어요`;
  const description = "탭해서 바로 참가 — 설치 없이 브라우저에서 8인 파티 게임. " + SITE_DESCRIPTION;
  return {
    title,
    description,
    robots: { index: false },
    openGraph: { title, description, siteName: SITE_NAME, type: "website", url: `/room/${normalized}`, images: [{ url: "/og.png", width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title, description, images: ["/og.png"] },
  };
}

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = normalizeRoomCode(decodeURIComponent(code));
  if (!isValidRoomCode(normalized)) redirect("/");
  if (normalized !== code) redirect(`/room/${normalized}`);
  return <RoomViewLoader roomCode={normalized} />;
}
