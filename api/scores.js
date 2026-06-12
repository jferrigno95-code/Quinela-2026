// Vercel Serverless Function — /api/scores
// Calls api-sports.io server-side (no CORS issue) and returns WC 2026 results
// Deploy alongside index.html — Vercel picks this up automatically

export default async function handler(req, res) {
  // Allow your Vercel app to call this endpoint
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET');

  const API_KEY = process.env.API_SPORTS_KEY || '84cb97940887a614942a00e77344f6ab';

  try {
    const response = await fetch(
      'https://v3.football.api-sports.io/fixtures?league=1&season=2026',
      {
        headers: {
          'x-apisports-key': API_KEY,
        },
      }
    );

    if (!response.ok) {
      return res.status(response.status).json({
        error: `API-Sports responded with ${response.status}`,
      });
    }

    const data = await response.json();

    // Check for API-level errors
    if (data.errors && Object.keys(data.errors).length > 0) {
      return res.status(400).json({ error: Object.values(data.errors)[0] });
    }

    // Return only what the app needs: id, teams, goals, status
    const fixtures = (data.response || []).map((f) => ({
      id: f.fixture?.id,
      status: f.fixture?.status?.short,
      home: f.teams?.home?.name,
      away: f.teams?.away?.name,
      goalsHome: f.goals?.home,
      goalsAway: f.goals?.away,
      minute: f.fixture?.status?.elapsed,
    }));

    res.status(200).json({ fixtures, remaining: data.parameters });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
