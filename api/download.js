export default async function handler(req, res) {
  const { url } = req.body;

  if (!url || !url.includes('instagram.com')) {
    return res.status(400).json({ error: 'Bad URL' });
  }

  try {
    // Здесь можно подключить реальный scraper
    // Пока используем публичный (замени на свой в будущем)
    const response = await fetch(`https://api.cobalt.tools/api/json`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });

    const data = await response.json();

    if (data.url) {
      res.json({ downloadUrl: data.url });
    } else {
      res.json({ downloadUrl: url }); // fallback
    }
  } catch (error) {
    res.json({ downloadUrl: `https://saveclip.app/?url=${encodeURIComponent(url)}` });
  }
}
