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

    // === ТВОЙ ПРОКСИ ===
    const agent = new SocksProxyAgent({
        host: '185.207.133.142',
        port: 7575,
        userId: 'Meur-243288',
        password: 'Meur-243288'
    });

    try {
        // ПОЛУЧАЕМ СТРАНИЦУ
        const pageRes = await fetch(url, {
            agent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const html = await pageRes.text();
        const mediaItems = [];

        // ИЩЕМ ВСЕ ВИДЕО
        const videoMatches = html.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/gi) || [];
        for (const videoUrl of videoMatches) {
            mediaItems.push({ url: videoUrl, type: 'video' });
        }

        // ИЩЕМ ВСЕ ИЗОБРАЖЕНИЯ
        const imageMatches = html.match(/https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp)[^\s"']*/gi) || [];
        for (const imageUrl of imageMatches) {
            mediaItems.push({ url: imageUrl, type: 'image' });
        }

        // ЕСЛИ НИЧЕГО НЕ НАШЛИ — ПАРСИМ JSON
        if (mediaItems.length === 0) {
            const jsonMatch = html.match(/window\._sharedData\s*=\s*({.+?});/s);
            if (jsonMatch) {
                try {
                    const data = JSON.parse(jsonMatch[1]);
                    const media = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
                    if (media) {
                        if (media.video_url) {
                            mediaItems.push({ url: media.video_url, type: 'video' });
                        }
                        if (media.display_url) {
                            mediaItems.push({ url: media.display_url, type: 'image' });
                        }
                        if (media.edge_sidecar_to_children?.edges) {
                            for (const edge of media.edge_sidecar_to_children.edges) {
                                const node = edge.node;
                                if (node.video_url) {
                                    mediaItems.push({ url: node.video_url, type: 'video' });
                                }
                                if (node.display_url) {
                                    mediaItems.push({ url: node.display_url, type: 'image' });
                                }
                            }
                        }
                    }
                } catch (e) {}
            }
        }

        // УБИРАЕМ ДУБЛИКАТЫ
        const uniqueMedia = [];
        const seen = new Set();
        for (const item of mediaItems) {
            if (!seen.has(item.url)) {
                seen.add(item.url);
                uniqueMedia.push(item);
            }
        }

        if (uniqueMedia.length === 0) {
            return res.status(404).json({ error: 'Медиа не найдены' });
        }

        return res.status(200).json({ media: uniqueMedia });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
