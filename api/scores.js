// Vercel Serverless Function — /api/scores
// Fuente 1: worldcup26.ir — live scores, sin API key
// Fuente 2: openfootball/worldcup.json — resultados finales, sin API key
// Sin CORS issues ya que corre server-side en Vercel

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=30, stale-while-revalidate=60');

  // --- Fuente 1: worldcup26.ir (live scores) ---
  try {
    const r1 = await fetch('https://worldcup26.ir/get/games', {
      headers: { 'Accept': 'application/json', 'User-Agent': 'QuinielaMundial2026' },
      signal: AbortSignal.timeout(5000),
    });
    if (r1.ok) {
      const raw = await r1.json();
      const games = Array.isArray(raw) ? raw : (raw.games || raw.matches || raw.data || []);
      if (games.length > 0) {
        const fixtures = games.map(g => ({
          home: g.home_team || g.homeTeam || g.team1 || g.home || '',
          away: g.away_team || g.awayTeam || g.team2 || g.away || '',
          goalsHome: g.home_score ?? g.homeScore ?? g.score1 ?? g.goals?.home ?? null,
          goalsAway: g.away_score ?? g.awayScore ?? g.score2 ?? g.goals?.away ?? null,
          status: normalizeStatus(g.status || g.state || g.match_status || ''),
          minute: g.minute || g.elapsed || null,
        })).filter(f => f.home && f.away);
        if (fixtures.length > 0) {
          return res.status(200).json({ fixtures, source: 'worldcup26.ir' });
        }
      }
    }
  } catch (e) {
    console.log('worldcup26.ir failed:', e.message);
  }

  // --- Fuente 2: openfootball GitHub (siempre actualizado con resultados) ---
  try {
    const r2 = await fetch(
      'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json',
      { signal: AbortSignal.timeout(8000) }
    );
    if (r2.ok) {
      const data = await r2.json();
      const matches = data.matches || [];
      const fixtures = matches.map(m => ({
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

  return res.status(503).json({
    error: 'Fuentes no disponibles. Ingresa resultados manualmente.',
    fixtures: [],
  });
}

function normalizeStatus(s) {
  const st = (s || '').toUpperCase().replace(/[_\s-]/g, '');
  if (['FT','FINISHED','COMPLETED','FULLTIME','FINAL'].includes(st)) return 'FT';
  if (['1H','FIRSTHALF','INPLAY','LIVE','INPROGRESS'].includes(st)) return '1H';
  if (['2H','SECONDHALF'].includes(st)) return '2H';
  if (['HT','HALFTIME'].includes(st)) return 'HT';
  if (['AET','AFTEREXTRATIME','ET'].includes(st)) return 'AET';
  if (['PEN','PENALTIES'].includes(st)) return 'PEN';
  return 'NS';
}
