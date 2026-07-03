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

    // === ПРОКСИ СКРЫТ ===
    const agent = new SocksProxyAgent({
        host: '185.207.133.142',
        port: 7575,
        userId: 'Meur-243288',
        password: 'Meur-243288'
    });

    try {
        const pageRes = await fetch(url, {
            agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        const html = await pageRes.text();
        const media = [];

        // ВИДЕО
        const videoMatches = html.match(/https?:\/\/[^\s"']+\.mp4[^\s"']*/gi) || [];
        for (const v of videoMatches) {
            if (!media.some(m => m.url === v)) {
                media.push({ url: v, type: 'video' });
            }
        }

        // ИЗОБРАЖЕНИЯ
        const imgMatches = html.match(/https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp)[^\s"']*/gi) || [];
        for (const img of imgMatches) {
            if (!media.some(m => m.url === img)) {
                media.push({ url: img, type: 'image' });
            }
        }

        // JSON-ДАННЫЕ (если ничего не нашли)
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
                                if (node.video_url) media.push({ url: node.video_url, type: 'video' });
                                if (node.display_url) media.push({ url: node.display_url, type: 'image' });
                            }
                        }
                    }
                } catch (_) {}
            }
        }

        // УБИРАЕМ ДУБЛИКАТЫ
        const unique = [];
        const seen = new Set();
        for (const item of media) {
            if (!seen.has(item.url)) {
                seen.add(item.url);
                unique.push(item);
            }
        }

        if (unique.length === 0) {
            return res.status(404).json({ error: 'Медиа не найдены' });
        }

        return res.status(200).json({ media: unique });

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });
    }
}
