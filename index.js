const express = require('express');
const cors = require('cors');
const ytSearch = require('yt-search');

const app = express();

// Cấu hình CORS mở cho tất cả tên miền truy cập
app.use(cors());
app.use(express.json());

// 1. API TÌM KIẾM BÀI HÁT YOUTUBE
app.get('/api/search', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.status(400).json({ error: 'Thiếu từ khóa tìm kiếm' });

        const searchResult = await ytSearch(query);
        const songs = searchResult.videos.slice(0, 30).map(video => ({
            id: video.videoId,
            title: video.title,
            artist: video.author.name,
            duration: video.timestamp,
            thumbnail: video.thumbnail,
            type: 'youtube'
        }));

        res.json(songs);
    } catch (error) {
        console.error('Lỗi tìm kiếm YouTube:', error);
        res.status(500).json({ error: 'Lỗi tìm kiếm YouTube' });
    }
});

// 2. API GỢI Ý TỪ KHÓA TÌM KIẾM (YOUTUBE AUTO-SUGGEST)
app.get('/api/suggestions', async (req, res) => {
    try {
        const query = req.query.q;
        if (!query) return res.json([]);

        const response = await fetch(`https://suggestqueries.google.com/complete/search?client=firefox&ds=yt&q=${encodeURIComponent(query)}`);
        const data = await response.json();
        const suggestions = data[1] || [];
        res.json(suggestions.slice(0, 8));
    } catch (error) {
        res.json([]);
    }
});

// 3. API XỬ LÝ & GIẢI MÃ LINK TIKTOK (HỖ TRỢ CẢ LINK RÚT GỌN vt.tiktok.com / vm.tiktok.com)
app.get('/api/tiktok', async (req, res) => {
    try {
        const tiktokUrl = req.query.url;
        if (!tiktokUrl) return res.status(400).json({ error: 'Thiếu đường dẫn TikTok' });

        // Tự động follow redirect để lấy URL gốc có chứa mã Video ID
        const response = await fetch(tiktokUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            redirect: 'follow'
        });

        const finalUrl = response.url;
        let videoId = null;

        // Trích xuất Video ID từ URL chuẩn
        const match = finalUrl.match(/\/video\/(\d+)/);
        if (match) {
            videoId = match[1];
        }

        // Lấy thông tin tiêu đề, tác giả qua TikTok oEmbed
        const oembedRes = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(finalUrl)}`);
        let metadata = {};
        if (oembedRes.ok) {
            metadata = await oembedRes.json();
        }

        // Nếu chưa có Video ID, tìm lại trong HTML iframe của oEmbed
        if (!videoId && metadata.html) {
            const idMatch = metadata.html.match(/data-video-id=["'](\d+)["']/) || metadata.html.match(/\/video\/(\d+)/);
            if (idMatch) videoId = idMatch[1];
        }

        if (!videoId) {
            return res.status(400).json({ error: 'Không thể nhận diện Video ID từ link TikTok này' });
        }

        res.json({
            id: `tiktok_${videoId}`,
            tiktokVideoId: videoId,
            tiktokUrl: finalUrl,
            title: metadata.title || 'Video TikTok',
            artist: metadata.author_name ? `@${metadata.author_name}` : 'TikTok Creator',
            thumbnail: metadata.thumbnail_url || 'https://sf16-sg.tiktokcdn.com/obj/eden-sg/u3kwyb_l_zlp/ljhwZfsne22q_wq_u3kwyb/tiktok_icon.png',
            duration: '--:--',
            type: 'tiktok'
        });
    } catch (error) {
        console.error('Lỗi xử lý TikTok:', error);
        res.status(500).json({ error: 'Không thể lấy dữ liệu TikTok từ Server' });
    }
});

// KHỞI ĐỘNG SERVER
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 Server backend đã chạy thành công tại cổng ${PORT}`);
});
