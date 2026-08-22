/**
 * 모델 응답을 본문과 부록 블록으로 가른다.
 *
 * 에이전트는 문서 본문을 쓰고, 그 뒤에 `===MEMORY===` 같은 표식으로 부록을 붙인다.
 * 부록은 사람이 읽을 문서가 아니라 파이프라인이 쓰는 데이터다.
 *
 * 순수 함수 — 파일을 읽지도 쓰지도 않는다.
 */

/**
 * @param {string} text  모델 응답 전문
 * @param {string[]} marks  찾을 표식들. 예: ["===MEMORY===", "===ISSUE==="]
 * @returns {{ body: string, sections: Record<string,string> }}
 */
export function splitSections(text, marks) {
  const found = marks
    .map((m) => ({ mark: m, at: text.indexOf(m) }))
    .filter((x) => x.at !== -1)
    .sort((a, b) => a.at - b.at);

  const body = (found.length ? text.slice(0, found[0].at) : text).trim();

  const sections = {};
  for (const [i, f] of found.entries()) {
    const from = f.at + f.mark.length;
    const to = i + 1 < found.length ? found[i + 1].at : text.length;
    sections[f.mark] = text.slice(from, to).trim();
  }

  return { body, sections };
}
