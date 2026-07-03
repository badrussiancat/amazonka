import { SocksProxyAgent } from 'socks-proxy-agent';

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

    // === ПРОКСИ (СКРЫТ) ===
    const agent = new SocksProxyAgent({
        host: '185.207.133.142',
        port: 7575,
        userId: 'Meur-243288',
        password: 'Meur-243288'
    });

    try {
        // 1. ПОЛУЧАЕМ СТРАНИЦУ ЧЕРЕЗ ПРОКСИ
        const pageRes = await fetch(url, {
            agent,
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

        // 2. ИЩЕМ ВСЕ ВИДЕО (.mp4)
        const videoMatches = html.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/gi) || [];
        for (const v of videoMatches) {
            if (!media.some(m => m.url === v)) {
                media.push({ url: v, type: 'video' });
            }
        }

        // 3. ИЩЕМ ВСЕ ИЗОБРАЖЕНИЯ
        const imgMatches = html.match(/https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp)[^\s"']*/gi) || [];
        for (const img of imgMatches) {
            if (!media.some(m => m.url === img)) {
                media.push({ url: img, type: 'image' });
            }
        }

        // 4. ЕСЛИ НИЧЕГО НЕ НАШЛИ — ПАРСИМ JSON
        if (media.length === 0) {
            const jsonMatch = html.match(/window\._sharedData\s*=\s*({.+?});/s);
            if (jsonMatch) {
                try {
                    const data = JSON.parse(jsonMatch[1]);
                    const post = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
                    
                    if (post) {
                        // Одиночный пост
                        if (post.video_url) {
                            media.push({ url: post.video_url, type: 'video' });
                        }
                        if (post.display_url) {
                            media.push({ url: post.display_url, type: 'image' });
                        }
                        
                        // Карусель (несколько фото/видео)
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
                } catch (_) {}
            }
        }

        // 5. ЕСЛИ ВСЁ РАВНО НЕТ — ИЩЕМ В ДРУГОМ JSON
        if (media.length === 0) {
            const jsonMatch = html.match(/<script type="application\/ld\+json">({.+?})<\/script>/s);
            if (jsonMatch) {
                try {
                    const data = JSON.parse(jsonMatch[1]);
                    if (data.image && data.image.url) {
                        media.push({ url: data.image.url, type: 'image' });
                    }
                    if (data.video && data.video.url) {
                        media.push({ url: data.video.url, type: 'video' });
                    }
                } catch (_) {}
            }
        }

        // 6. УБИРАЕМ ДУБЛИКАТЫ
        const unique = [];
        const seen = new Set();
        for (const item of media) {
            if (!seen.has(item.url)) {
                seen.add(item.url);
                unique.push(item);
            }
        }

        if (unique.length === 0) {
            return res.status(404).json({ 
                error: 'Медиа не найдены. Убедитесь, что пост публичный.' 
            });
        }

        return res.status(200).json({ media: unique });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ 
            error: error.message || 'Ошибка загрузки' 
        });
    }
}
