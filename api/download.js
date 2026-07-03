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
        // === ИЗВЛЕКАЕМ ID ПОСТА ИЗ ССЫЛКИ ===
        const postId = url.match(/\/p\/([^/?]+)/)?.[1] || 
                       url.match(/\/reel\/([^/?]+)/)?.[1] ||
                       url.match(/\/tv\/([^/?]+)/)?.[1];

        if (!postId) {
            throw new Error('Не удалось извлечь ID поста');
        }

        console.log('🔍 ID поста:', postId);

        // === ИСПОЛЬЗУЕМ ПУБЛИЧНЫЙ API ДЛЯ ПОЛУЧЕНИЯ ДАННЫХ ===
        // 1. Пробуем через oembed (дает thumbnail)
        const oembedRes = await fetch(`https://api.instagram.com/oembed?url=${encodeURIComponent(url)}`);
        const oembedData = await oembedRes.json();
        
        const media = [];

        if (oembedData.thumbnail_url) {
            media.push({ 
                url: oembedData.thumbnail_url, 
                type: 'image' 
            });
        }

        // 2. Пробуем через Instagram Graph API (публичные данные)
        // Для этого нужен access_token, но пока пробуем без него
        const graphRes = await fetch(`https://graph.instagram.com/${postId}?fields=id,media_type,media_url,permalink,thumbnail_url,children{media_type,media_url}`);
        const graphData = await graphRes.json();

        if (graphData.media_url) {
            if (graphData.media_type === 'VIDEO') {
                media.push({ url: graphData.media_url, type: 'video' });
            } else {
                media.push({ url: graphData.media_url, type: 'image' });
            }
        }

        // 3. Обрабатываем карусель
        if (graphData.children?.data) {
            for (const child of graphData.children.data) {
                if (child.media_type === 'VIDEO' && child.media_url) {
                    media.push({ url: child.media_url, type: 'video' });
                } else if (child.media_url) {
                    media.push({ url: child.media_url, type: 'image' });
                }
            }
        }

        if (media.length === 0) {
            return res.status(404).json({ 
                error: 'Медиа не найдены. Пост может быть закрытым.' 
            });
        }

        return res.status(200).json({ media });

    } catch (error) {
        console.error('❌ Ошибка:', error);
        
        // === FALLBACK: ВОЗВРАЩАЕМ ССЫЛКУ ДЛЯ ОТКРЫТИЯ В INSTAGRAM ===
        return res.status(200).json({ 
            media: [{ 
                url: `https://www.instagram.com/p/${postId || ''}/`, 
                type: 'link' 
            }],
            fallback: true,
            message: 'Не удалось загрузить медиа. Откройте пост в Instagram.'
        });
    }
}
