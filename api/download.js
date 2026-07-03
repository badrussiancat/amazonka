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
        console.log('🔍 Загружаем через прокси:', url);

        // === ИСПОЛЬЗУЕМ ПУБЛИЧНЫЙ ПРОКСИ ДЛЯ ОБХОДА БЛОКИРОВКИ ===
        // Прокси-сервер, который не блокирует Instagram
        
        // ВАРИАНТ 1: Через api.allorigins.win (бесплатный CORS-прокси)
        const proxyUrl = `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`;
        
        const pageRes = await fetch(proxyUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!pageRes.ok) {
            throw new Error(`Прокси вернул ${pageRes.status}`);
        }

        const html = await pageRes.text();
        const media = [];

        // === 1. ВИДЕО (.mp4) ===
        const videoRegex = /https?:\/\/[^\s"']+\.mp4[^\s"']*/gi;
        const videoMatches = html.match(videoRegex) || [];
        for (const v of videoMatches) {
            if (!media.some(m => m.url === v)) {
                media.push({ url: v, type: 'video' });
            }
        }

        // === 2. ИЗОБРАЖЕНИЯ ===
        const imgRegex = /https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp)[^\s"']*/gi;
        const imgMatches = html.match(imgRegex) || [];
        for (const img of imgMatches) {
            if (!media.some(m => m.url === img)) {
                media.push({ url: img, type: 'image' });
            }
        }

        // === 3. JSON (window._sharedData) ===
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

        // === 4. УБИРАЕМ ДУБЛИКАТЫ ===
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
        
        // === ЕСЛИ ПРОКСИ НЕ РАБОТАЕТ — ВОЗВРАЩАЕМ ССЫЛКУ ===
        return res.status(200).json({ 
            media: [{ 
                url: url,
                type: 'link' 
            }],
            fallback: true,
            message: 'Не удалось загрузить медиа. Нажмите "Скачать всё" чтобы открыть пост.'
        });
    }
}
