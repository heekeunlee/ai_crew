/**
 * 모델 응답에서 문서 본문만 남긴다.
 *
 * "8회 검색을 모두 마쳤습니다. 요약본을 작성합니다." 같은 서두를 모델이 붙이는 일이
 * 잦다. TASK.md로 부탁해봐야 지켜질 때도 있고 아닐 때도 있으니, 첫 H1 앞을 코드로
 * 잘라내 결과를 보장한다.
 *
 * 순수 함수 — 파일을 읽지도 쓰지도 않는다.
 */

export function stripPreamble(text) {
  const lines = text.split("\n");
  const at = lines.findIndex((l) => /^#\s+\S/.test(l));

  // H1이 없으면 손대지 않는다. 형식이 깨진 응답을 더 망가뜨리지 않기 위해서다.
  if (at <= 0) return text.trim();

  // 잘라낼 부분이 본문일 수도 있다. 서두는 짧다는 가정으로 방어선을 둔다.
  const dropped = lines.slice(0, at).join("\n").trim();
  if (dropped.length > 400) return text.trim();

  return lines.slice(at).join("\n").trim();
}
