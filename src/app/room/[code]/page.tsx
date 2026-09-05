import { redirect } from "next/navigation";
import { RoomViewLoader } from "@/components/lobby/RoomViewLoader";
import { isValidRoomCode, normalizeRoomCode } from "@/lib/room";

export default async function RoomPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const normalized = normalizeRoomCode(decodeURIComponent(code));
  if (!isValidRoomCode(normalized)) redirect("/");
  if (normalized !== code) redirect(`/room/${normalized}`);
  return <RoomViewLoader roomCode={normalized} />;
}
