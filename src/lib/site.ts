/** Public origin for absolute links in metadata (set NEXT_PUBLIC_SITE_URL on the deploy). */
export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://zuuun.app").replace(/\/$/, "");
export const SITE_NAME = "ZUUUN";
export const SITE_TITLE = "ZUUUN — 친구랑 8인 파티 게임";
export const SITE_DESCRIPTION = "ZUN 캐릭터로 즐기는 15가지 파티 모드. 밀치기, 레이스, 감염, 폭탄 돌리기까지. 설치 없이 브라우저에서 바로 플레이.";
