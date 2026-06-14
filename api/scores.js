// Vercel Serverless Function — /api/scores
// Usa worldcup26.ir — API gratis y open-source específica para el Mundial 2026
// Sin API key requerida. Endpoint: https://worldcup26.ir/get/games

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');
  res.setHeader('Cache-Control', 's-maxage=60'); // cache 60 seg en Vercel

  try {
    const response = await fetch('https://worldcup26.ir/get/games', {
      headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
      // Fallback: intentar openfootball que también tiene los datos
      const fallback = await fetch(
        'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
      );
      if (!fallback.ok) {
        return res.status(502).json({ error: 'Ambas fuentes no disponibles' });
      }
      const fbData = await fallback.json();
      const fixtures = parseOpenFootball(fbData);
      return res.status(200).json({ fixtures, source: 'openfootball' });
    }

    const data = await response.json();

    // worldcup26.ir devuelve array de partidos
    // Normalizar al formato que usa la app
    const fixtures = (Array.isArray(data) ? data : data.games || data.matches || [])
      .map(g => ({
        home: g.home_team?.name || g.homeTeam?.name || g.home || '',
        away: g.away_team?.name || g.awayTeam?.name || g.away || '',
        goalsHome: g.home_score ?? g.homeScore ?? g.goals?.home ?? null,
        goalsAway: g.away_score ?? g.awayScore ?? g.goals?.away ?? null,
        status: normalizeStatus(g.status || g.state || ''),
        minute: g.minute || g.elapsed || null,
      }));

    res.status(200).json({ fixtures, source: 'worldcup26.ir' });

  } catch (err) {
    // Último fallback: openfootball GitHub
    try {
      const fallback = await fetch(
        'https://raw.githubusercontent.com/openfootball/worldcup.json/master/2026/worldcup.json'
      );
      const fbData = await fallback.json();
      const fixtures = parseOpenFootball(fbData);
      return res.status(200).json({ fixtures, source: 'openfootball' });
    } catch (e) {
      return res.status(500).json({ error: err.message });
    }
  }
}

function normalizeStatus(s) {
  const st = (s || '').toUpperCase();
  if (st === 'COMPLETED' || st === 'FINISHED' || st === 'FT' || st === 'FULL_TIME') return 'FT';
  if (st === 'IN_PROGRESS' || st === 'LIVE' || st === '1H' || st === '2H') return '1H';
  if (st === 'HALF_TIME' || st === 'HT') return 'HT';
  if (st === 'AET' || st === 'AFTER_EXTRA_TIME') return 'AET';
  if (st === 'PEN' || st === 'PENALTIES') return 'PEN';
  return 'NS';
}

function parseOpenFootball(data) {
  // openfootball format: { matches: [ { team1, team2, score: { ft: [h,a] } } ] }
  const matches = data.matches || [];
  return matches
    .filter(m => m.score && m.score.ft)
    .map(m => ({
      home: m.team1 || '',
      away: m.team2 || '',
      goalsHome: m.score.ft[0],
      goalsAway: m.score.ft[1],
      status: 'FT',
      minute: 90,
    }));
}
