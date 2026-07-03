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

    // === ТВОЙ ПРОКСИ (СКРЫТ) ===
    const agent = new SocksProxyAgent({
        host: '185.207.133.142',
        port: 7575,
        userId: 'Meur-243288',
        password: 'Meur-243288'
    });

    try {
        console.log('🔍 Запрос к Instagram через прокси:', url);

        // 1. ПОЛУЧАЕМ СТРАНИЦУ INSTAGRAM ЧЕРЕЗ ПРОКСИ
        const pageRes = await fetch(url, {
            agent: agent,
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
        console.log('📄 Получен HTML, длина:', html.length);

        // 2. ИЩЕМ ВИДЕО (.mp4)
        let mediaUrl = null;
        
        // Поиск mp4 в разных форматах
        const videoPatterns = [
            /"video_url":"([^"]+\.mp4[^"]*)"/i,
            /"video_versions":\[{"url":"([^"]+\.mp4[^"]*)"/i,
            /"display_url":"([^"]+\.mp4[^"]*)"/i,
            /https?:\/\/[^\s"']+\.mp4[^\s"']*/i
        ];

        for (const pattern of videoPatterns) {
            const match = html.match(pattern);
            if (match) {
                mediaUrl = match[1] || match[0];
                // Очищаем от экранирования
                mediaUrl = mediaUrl.replace(/\\/g, '');
                break;
            }
        }

        // 3. ЕСЛИ НЕТ ВИДЕО — ИЩЕМ ИЗОБРАЖЕНИЕ
        if (!mediaUrl) {
            const imagePatterns = [
                /"display_url":"([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i,
                /"display_src":"([^"]+\.(jpg|jpeg|png|gif|webp)[^"]*)"/i,
                /https?:\/\/[^\s"']+\.(jpg|jpeg|png|gif|webp)[^\s"']*/i
            ];

            for (const pattern of imagePatterns) {
                const match = html.match(pattern);
                if (match) {
                    mediaUrl = match[1] || match[0];
                    mediaUrl = mediaUrl.replace(/\\/g, '');
                    break;
                }
            }
        }

        // 4. ЕСЛИ НЕ НАШЛИ — ИЩЕМ В JSON-ДАННЫХ
        if (!mediaUrl) {
            const jsonMatch = html.match(/window\._sharedData\s*=\s*({.+?});/s);
            if (jsonMatch) {
                try {
                    const data = JSON.parse(jsonMatch[1]);
                    const media = data?.entry_data?.PostPage?.[0]?.graphql?.shortcode_media;
                    if (media) {
                        if (media.video_url) {
                            mediaUrl = media.video_url;
                        } else if (media.display_url) {
                            mediaUrl = media.display_url;
                        }
                    }
                } catch (e) {
                    console.log('Ошибка парсинга JSON');
                }
            }
        }

        // 5. ЕСЛИ ВСЁ РАВНО НЕТ — ОШИБКА
        if (!mediaUrl) {
            console.log('❌ Медиа не найдено в HTML');
            return res.status(404).json({ 
                error: 'Медиа не найдено. Возможно, ссылка закрыта или это Stories.' 
            });
        }

        console.log('✅ Найдена медиа-ссылка:', mediaUrl.substring(0, 100) + '...');

        // 6. СКАЧИВАЕМ МЕДИА ЧЕРЕЗ ПРОКСИ
        const mediaRes = await fetch(mediaUrl, {
            agent: agent,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });

        if (!mediaRes.ok) {
            throw new Error(`Не удалось скачать медиа: ${mediaRes.status}`);
        }

        const buffer = await mediaRes.arrayBuffer();
        const contentType = mediaRes.headers.get('content-type') || 'video/mp4';
        const ext = contentType.includes('image') ? '.jpg' : '.mp4';

        // 7. ВОЗВРАЩАЕМ ФАЙЛ
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="instagram_${Date.now()}${ext}"`);
        res.setHeader('Content-Length', buffer.byteLength);
        res.status(200).send(Buffer.from(buffer));

        console.log('✅ Файл отправлен клиенту, размер:', buffer.byteLength);

    } catch (error) {
        console.error('❌ Ошибка:', error.message);
        res.status(500).json({ 
            error: 'Ошибка загрузки: ' + error.message,
            details: error.stack 
        });
    }
}
