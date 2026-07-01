// Vercel Serverless Function — /api/scores
// ESPN hidden API — gratis, sin API key, actualiza en tiempo real
// Fallback: openfootball/worldcup.json

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  // --- Fuente 1: ESPN ---
  try {
    const r1 = await fetch(
      'https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?limit=200&dates=20260628-20260719',
      { headers: { 'Accept': 'application/json' }, signal: AbortSignal.timeout(6000) }
    );
    if (r1.ok) {
      const data = await r1.json();
      const events = data.events || [];
      if (events.length > 0) {
        const fixtures = events.map(ev => {
          const comp = ev.competitions?.[0];
          const competitors = comp?.competitors || [];
          const home = competitors.find(c => c.homeAway === 'home');
          const away = competitors.find(c => c.homeAway === 'away');
          const statusType = comp?.status?.type;
          const statusName = statusType?.name || ''; // e.g. "STATUS_FULL_TIME", "STATUS_FINAL_AET", "STATUS_FINAL_PEN"

          // Determine if this is AET or PEN (extra time / penalties)
          // ESPN status names: STATUS_FINAL = normal FT, STATUS_FINAL_AET = after extra time, STATUS_FINAL_PEN = penalties
          const isAET = statusName.includes('AET') || statusName.includes('EXTRA');
          const isPEN = statusName.includes('PEN') || statusName.includes('PENALT');
          const isFT  = statusType?.completed && !isAET && !isPEN;
          const isLive = statusType?.state === 'in';

          return {
            home: home?.team?.displayName || home?.team?.name || '',
            away: away?.team?.displayName || away?.team?.name || '',
            goalsHome: home?.score != null ? parseInt(home.score) : null,
            goalsAway: away?.score != null ? parseInt(away.score) : null,
            // Send clean status so app knows what to do
            status: isAET ? 'AET' : isPEN ? 'PEN' : isFT ? 'FT' : isLive ? '1H' : 'NS',
            minute: comp?.status?.displayClock || null,
          };
        }).filter(f => f.home && f.away);

        if (fixtures.length > 0) {
          return res.status(200).json({ fixtures, source: 'espn' });
        }
      }
    }
  } catch (e) {
    console.log('ESPN failed:', e.message);
  }

  // --- Fallback: openfootball ---
  try {
    const r2 = await fetch(
      'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
      { signal: AbortSignal.timeout(8000) }
    );
    if (r2.ok) {
      const data = await r2.json();
      const fixtures = (data.matches || []).map(m => ({
        home: m.team1 || '',
        away: m.team2 || '',
        goalsHome: m.score?.ft?.[0] ?? null,
        goalsAway: m.score?.ft?.[1] ?? null,
        status: (m.score?.ft != null) ? 'FT' : 'NS',
        minute: null,
      })).filter(f => f.home && f.away);
      if (fixtures.length > 0) {
        return res.status(200).json({ fixtures, source: 'openfootball' });
      }
    }
  } catch (e) {
    console.log('openfootball failed:', e.message);
  }

  return res.status(503).json({ error: 'Fuentes no disponibles.', fixtures: [] });
}
