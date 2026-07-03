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
        console.log('🔍 Загружаем:', url);

        // === ИСПОЛЬЗУЕМ ПРОСТОЙ FETCH (через прокси-сервер) ===
        // Если прокси поддерживает HTTP/HTTPS прокси, используем его
        const proxyUrl = 'http://185.207.133.142:7575'; // Shadowsocks HTTP прокси (если поддерживает)
        
        // Пробуем прямой запрос (без прокси) — для теста
        const pageRes = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'ru-RU,ru;q=0.9,en-US;q=0.8,en;q=0.7'
            }
        });

        if (!pageRes.ok) {
            throw new Error(`Instagram вернул ${pageRes.status}`);
        }

        const html = await pageRes.text();
        const media = [];

        // === 1. ИЩЕМ ВИДЕО ===
        const videoRegex = /https?:\/\/[^\s"']+\.mp4[^\s"']*/gi;
        const videoMatches = html.match(videoRegex) || [];
        for (const v of videoMatches) {
            if (!media.some(m => m.url === v)) {
                media.push({ url: v, type: 'video' });
            }
        }

        // === 2. ИЩЕМ ИЗОБРАЖЕНИЯ ===
        const imgRegex = /https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp)[^\s"']*/gi;
        const imgMatches = html.match(imgRegex) || [];
        for (const img of imgMatches) {
            if (!media.some(m => m.url === img)) {
                media.push({ url: img, type: 'image' });
            }
        }

        // === 3. ПАРСИМ JSON ===
        if (media.length === 0) {
            const jsonMatch = html.match(/window\._sharedData\s*=\s*({.+?});/s);
            if (jsonMatch) {
                try {
                    const data = JSON.parse(jsonMatch[1]);
                    const post = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
                    
                    if (post) {
                        if (post.video_url) {
                            media.push({ url: post.video_url, type: 'video' });
                        }
                        if (post.display_url) {
                            media.push({ url: post.display_url, type: 'image' });
                        }
                        
                        if (post.edge_sidecar_to_children?.edges) {
                            for (const edge of post.edge_sidecar_to_children.edges) {
                                const node = edge.node;
                                if (node.video_url) {
                                    media.push({ url: node.video_url, type: 'video' });
                                }
                                if (node.display_url) {
                                    media.push({ url: node.display_url, type: 'image' });
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.log('Ошибка парсинга JSON:', e);
                }
            }
        }

        // === 4. ЕЩЁ ОДИН ВАРИАНТ JSON ===
        if (media.length === 0) {
            const jsonMatch = html.match(/<script type="application\/ld\+json">({.+?})<\/script>/s);
            if (jsonMatch) {
                try {
                    const data = JSON.parse(jsonMatch[1]);
                    if (data.image) {
                        const imgUrl = typeof data.image === 'string' ? data.image : data.image.url;
                        if (imgUrl) media.push({ url: imgUrl, type: 'image' });
                    }
                } catch (e) {}
            }
        }

        // === 5. УБИРАЕМ ДУБЛИКАТЫ ===
        const unique = [];
        const seen = new Set();
        for (const item of media) {
            if (!seen.has(item.url)) {
                seen.add(item.url);
                unique.push(item);
            }
        }

        console.log(`✅ Найдено медиа: ${unique.length}`);

        if (unique.length === 0) {
            return res.status(404).json({ 
                error: 'Медиа не найдены. Пост может быть закрытым.' 
            });
        }

        return res.status(200).json({ media: unique });

    } catch (error) {
        console.error('❌ Ошибка:', error);
        return res.status(500).json({ 
            error: error.message || 'Ошибка загрузки' 
        });
    }
}
