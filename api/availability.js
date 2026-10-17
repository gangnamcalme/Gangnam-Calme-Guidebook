/* 예약 페이지용: 에어비앤비 등 다른 사이트의 "달력 내보내기(iCal)" 링크를 읽어서
   이미 예약된 밤(날짜)을 알려 줍니다.
   링크는 공개 저장소에 올리지 않고 Vercel 환경 변수 ICAL_URLS 에 넣어 둡니다.
   (여러 개면 쉼표나 줄바꿈으로 구분) */

function ymd(s) {
  return s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
}
function addDay(d, n) {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}

/* iCal 글자에서 예약 기간을 뽑아 막힌 밤 목록으로 바꿉니다 */
function parseIcal(text) {
  const out = [];
  const lines = String(text).replace(/\r?\n[ \t]/g, "").split(/\r?\n/);
  let start = null, end = null, inEv = false;
  for (const line of lines) {
    if (line === "BEGIN:VEVENT") { inEv = true; start = end = null; continue; }
    if (line === "END:VEVENT") {
      if (inEv && start) {
        const last = end && end > start ? end : addDay(start, 1);
        for (let d = start; d < last; d = addDay(d, 1)) out.push(d);
      }
      inEv = false; continue;
    }
    if (!inEv) continue;
    const m = line.match(/^(DTSTART|DTEND)[^:]*:(\d{8})/);
    if (m) { if (m[1] === "DTSTART") start = ymd(m[2]); else end = ymd(m[2]); }
  }
  return out;
}

module.exports = async function (req, res) {
  const urls = String(process.env.ICAL_URLS || "").split(/[\s,]+/).filter(u => /^https?:\/\//.test(u));
  const blocked = new Set();
  let okCount = 0;
  await Promise.all(urls.map(async u => {
    try {
      const r = await fetch(u, { headers: { "User-Agent": "GangnamCalme-Booking/1.0" } });
      if (!r.ok) return;
      parseIcal(await r.text()).forEach(d => blocked.add(d));
      okCount++;
    } catch (e) {}
  }));
  res.setHeader("Cache-Control", "s-maxage=600, stale-while-revalidate=3600");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.status(200).send(JSON.stringify({ connected: urls.length, ok: okCount, blocked: Array.from(blocked).sort() }));
};

module.exports.parseIcal = parseIcal;
