/**
 * 모델 응답을 본문과 부록 블록으로 가른다.
 *
 * 에이전트는 문서 본문을 쓰고, 그 뒤에 `===MEMORY===` 같은 표식으로 부록을 붙인다.
 * 부록은 사람이 읽을 문서가 아니라 파이프라인이 쓰는 데이터다.
 *
 * 표식은 **줄 전체를 차지할 때만** 표식으로 본다. 본문이 표식 이름을 인용하는
 * 일이 실제로 있었다 — 메카닉이 이 파이프라인을 점검하면서 보고서 안에서
 * 표식을 언급하자 거기서 본문이 잘리고 나머지가 부록으로 흘러들어갔다.
 *
 * 순수 함수 — 파일을 읽지도 쓰지도 않는다.
 */

/**
 * @param {string} text  모델 응답 전문
 * @param {string[]} marks  찾을 표식들. 예: ["===MEMORY===", "===ISSUE==="]
 * @returns {{ body: string, sections: Record<string,string> }}
 */
export function splitSections(text, marks) {
  const want = new Set(marks);
  const found = [];
  const seen = new Set();

  let at = 0;
  for (const line of String(text).split("\n")) {
    const mark = line.trim();
    // 같은 표식이 여러 번 나오면 첫 번째만 센다
    if (want.has(mark) && !seen.has(mark)) {
      seen.add(mark);
      found.push({ mark, at, from: at + line.length + 1 });
    }
    at += line.length + 1;
  }

  const body = (found.length ? String(text).slice(0, found[0].at) : String(text)).trim();

  const sections = {};
  for (const [i, f] of found.entries()) {
    const to = i + 1 < found.length ? found[i + 1].at : text.length;
    sections[f.mark] = String(text).slice(f.from, to).trim();
  }

  return { body, sections };
}
