export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.body;

    if (!url || !url.includes('instagram.com')) {
        return res.status(400).json({ error: 'Невалидная ссылка' });
    }

    try {
        // === ИСПОЛЬЗУЕМ РАБОЧИЙ ПУБЛИЧНЫЙ API ===
        // 1. Пробуем через api.instagram.com/oembed
        const oembedRes = await fetch(`https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`);
        const oembedData = await oembedRes.json();

        if (oembedData.thumbnail_url) {
            // Скачиваем изображение
            const imageRes = await fetch(oembedData.thumbnail_url);
            const buffer = await imageRes.arrayBuffer();
            
            res.setHeader('Content-Type', 'image/jpeg');
            res.setHeader('Content-Disposition', `attachment; filename="instagram_${Date.now()}.jpg"`);
            return res.status(200).send(Buffer.from(buffer));
        }

        // 2. Пробуем через другой API
        const apiUrl = `https://instagram-downloader-download-instagram-videos-stories.p.rapidapi.com/index?url=${encodeURIComponent(url)}`;
        const rapidRes = await fetch(apiUrl, {
            headers: {
                'x-rapidapi-key': 'ваш_ключ_rapidapi', // Нужно зарегистрироваться на rapidapi.com
                'x-rapidapi-host': 'instagram-downloader-download-instagram-videos-stories.p.rapidapi.com'
            }
        });
        const data = await rapidRes.json();

        if (data.media) {
            const mediaRes = await fetch(data.media);
            const buffer = await mediaRes.arrayBuffer();
            const contentType = mediaRes.headers.get('content-type') || 'video/mp4';
            const ext = contentType.includes('image') ? '.jpg' : '.mp4';
            
            res.setHeader('Content-Type', contentType);
            res.setHeader('Content-Disposition', `attachment; filename="instagram_${Date.now()}${ext}"`);
            return res.status(200).send(Buffer.from(buffer));
        }

        // 3. Fallback — возвращаем ссылку для скачивания через saveclip
        return res.status(200).json({ 
            downloadUrl: `https://saveclip.app/?url=${encodeURIComponent(url)}`,
            fallback: true 
        });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: 'Ошибка загрузки: ' + error.message });
    }
}
