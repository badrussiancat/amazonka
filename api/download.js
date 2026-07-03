import { SocksProxyAgent } from 'socks-proxy-agent';

export default async function handler(req, res) {
    // Разрешаем CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    const { url } = req.body;

    if (!url || !url.includes('instagram.com')) {
        return res.status(400).json({ error: 'Невалидная ссылка' });
    }

    // === ДАННЫЕ ПРОКСИ СКРЫТЫ ЗДЕСЬ ===
    const proxyConfig = {
        host: '185.207.133.142',
        port: 7575,
        password: 'Meur-243288',
        userId: 'Meur-243288'
    };

    try {
        const agent = new SocksProxyAgent(proxyConfig);

        // 1. Получаем страницу Instagram через прокси
        const pageRes = await fetch(url, {
            agent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const html = await pageRes.text();

        // 2. Ищем видео
        let mediaUrl = null;
        const videoMatch = html.match(/https?:\/\/[^\s"]+\.mp4[^\s"]*/i);
        if (videoMatch) mediaUrl = videoMatch[0];

        // 3. Ищем изображение
        if (!mediaUrl) {
            const imageMatch = html.match(/https?:\/\/[^\s"]+\.(jpg|jpeg|png|gif|webp)[^\s"]*/i);
            if (imageMatch) mediaUrl = imageMatch[0];
        }

        // 4. Fallback через oembed
        if (!mediaUrl) {
            const oembedRes = await fetch(`https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`, {
                agent: agent
            });
            const oembedData = await oembedRes.json();
            if (oembedData.thumbnail_url) {
                mediaUrl = oembedData.thumbnail_url;
            }
        }

        if (!mediaUrl) {
            return res.status(404).json({ error: 'Медиа не найдено' });
        }

        // 5. Скачиваем медиа через прокси
        const mediaRes = await fetch(mediaUrl, {
            agent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const buffer = await mediaRes.arrayBuffer();
        const contentType = mediaRes.headers.get('content-type') || 'video/mp4';
        const ext = contentType.includes('image') ? '.jpg' : '.mp4';

        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="instagram_media${ext}"`);
        res.status(200).send(Buffer.from(buffer));

    } catch (error) {
        console.error('Error:', error);
        res.status(500).json({ error: 'Ошибка загрузки' });
    }
}
