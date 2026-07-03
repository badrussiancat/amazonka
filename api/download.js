// api/download.js
export default async function handler(req, res) {
    const { url } = req.body;
    
    // Используем публичный API (бесплатный, но с лимитами)
    const response = await fetch(`https://api.cobalt.tools/api/json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    
    const data = await response.json();
    // data.url — прямая ссылка на скачивание
}
