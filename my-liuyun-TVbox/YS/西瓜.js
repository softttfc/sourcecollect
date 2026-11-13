// 西瓜视频 - 官方接口 Quick (琉芸JS版)
// 分类/筛选: POST /api/cinema/filterv2/albums (postType:json)
// 详情分集: ib.snssdk.com/vapp/lvideo/api/info/
// 播放直链: vas.snssdk.com/video/openapi/v1/ (Authorization=auth_token + ptoken=business_token)
// 官方搜索被Argus保护, 兜底片库扫描+内存索引缓存

const SITE = 'https://www.ixigua.com';
const FILTER_API = SITE + '/api/cinema/filterv2/albums';
const SEARCH_API = SITE + '/api/searchv2/lvideo/';
const LVIDEO_API = 'https://ib.snssdk.com/vapp/lvideo/api/info/';
const PLAY_API = 'https://vas.snssdk.com/video/openapi/v1/';
const ARTICLE_API = 'https://ib.snssdk.com/video/app/article/full/0/0/';
const PAGE_SIZE = 18;
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

const HEADER = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': SITE + '/cinema/filter/dianshiju/',
    'Accept': 'application/json, text/plain, */*',
    'Origin': SITE
};
const LVIDEO_HEADER = {
    'User-Agent': 'okhttp/3.12.1',
    'Accept': 'application/json',
    'Referer': 'https://m.ixigua.com/'
};
const PLAY_HEADER = {
    'User-Agent': 'Mozilla/5.0 (Linux; Android 12; Pixel 6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
    'Referer': SITE + '/',
    'Origin': SITE
};

const CATE = [['电视剧', 'dianshiju'], ['电影', 'dianying'], ['动漫', 'dongman'], ['纪录片', 'jilupian'], ['少儿', 'shaoer'], ['综艺', 'zongyi']];
const CLARITY_FILTER = [
    { n: '自动 (默认最高)', v: 'auto' }, { n: '4K 超清', v: '4k' }, { n: '1080P 高清', v: '1080p' },
    { n: '720P', v: '720p' }, { n: '480P', v: '480p' }, { n: '360P', v: '360p' }
];
const QUALITY_MAP = { auto: '', '4k': '4k', '1080p': '1080p', '720p': '720p', '480p': '480p', '360p': '360p' };
const PREFER_HEIGHT = { '4k': 2160, '1080p': 1080, '720p': 720, '480p': 480, '360p': 360 };
const CLARITY_ORDER = [['4k', '4K超清'], ['1080p', '1080P高清'], ['720p', '720P'], ['480p', '480P'], ['360p', '360P']];
const CLARITY_DEFAULT_TAGS = ['4k', '1080p', '720p', '480p', '360p'];
// 少儿必须传「儿童」否则串成电视剧
const TYPE_FILTER = { dianshiju: '电视剧', dianying: '电影', dongman: '动漫', jilupian: '纪录片', shaoer: '儿童', zongyi: '综艺' };
// albumTypeList 期望值, 滤掉串台
const ALBUM_TYPE = { dianshiju: 2, dianying: 1, dongman: 3, jilupian: 5, shaoer: 13, zongyi: 4 };

let userid = '';
let quality = 'auto';
// 片库索引缓存(搜索兜底用)
let _catIndex = null, _catScanned = null, _catDone = null;

function toInt(v, d) {
    const n = parseInt(v, 10);
    return isNaN(n) ? (d || 0) : n;
}

function fetchText(url, headers, timeout) {
    try {
        const r = req(url, { headers: headers || HEADER, timeout: timeout || 20000 });
        return (r && r.content) || '';
    } catch (e) { return ''; }
}

function fetchJson(url, headers, timeout) {
    const t = fetchText(url, headers, timeout);
    try { return JSON.parse(t); } catch (e) { return {}; }
}

// ==================== id 打包 ====================
function packId(title, albumId, actor, pic, year, area, intro, tags, eps, aweme, user) {
    const clean = (s) => String(s || '').replace(/###/g, ' ').replace(/\n/g, ' ').trim();
    return [clean(title), clean(albumId), clean(actor), clean(pic), clean(year), clean(area), clean(intro), clean(tags), String(eps || 1), clean(aweme), user ? '1' : '0'].join('###');
}
function unpackId(raw) {
    const parts = String(raw || '').split('###');
    while (parts.length < 11) parts.push('');
    return { title: parts[0], albumId: parts[1], actor: parts[2], pic: parts[3], year: parts[4], area: parts[5], intro: parts[6], tags: parts[7], eps: parts[8] || '1', aweme: parts[9], user: parts[10] || '0' };
}

// ==================== 筛选表 ====================
function ftValues(names) {
    return names.map(n => ({ n: n, v: n }));
}
function buildFilters() {
    const sortVals = ftValues(['综合排序', '最新上线', '热度最高', '评分最高', '最多播放']);
    const paidVals = ftValues(['全部资费', '免费', '付费']);
    const areaTv = ftValues(['全部地区', '内地', '韩国', '中国香港', '中国台湾', '美国', '日本', '泰国', '英国', '新加坡', '其他']);
    const areaMovie = ftValues(['全部地区', '内地', '韩国', '中国香港', '美国', '日本', '英国', '法国', '其他']);
    const areaAnime = ftValues(['全部地区', '内地', '日本', '美国', '其他']);
    const tagTv = ftValues(['全部类型', '爱情', '古装', '悬疑', '喜剧', '剧情', '奇幻', '动作', '犯罪', '都市', '家庭', '历史', '军旅', '武侠', '战争', '其他']);
    const tagMovie = ftValues(['全部类型', '喜剧', '动作', '爱情', '科幻', '恐怖', '战争', '动画', '犯罪', '奇幻', '惊悚', '历史', '古装']);
    const tagAnime = ftValues(['全部类型', '热血', '恋爱', '奇幻', '搞笑', '冒险', '科幻', '治愈', '其他']);
    const tagDoc = ftValues(['全部类型', '自然', '历史', '人物', '社会', '科技', '其他']);
    const tagKids = ftValues(['全部类型', '动画', '益智', '儿歌', '其他']);
    const tagZy = ftValues(['全部类型', '真人秀', '访谈', '音乐', '搞笑', '选秀', '其他']);
    const pack = (area, tag) => [
        { key: 'area', name: '地区', value: area },
        { key: 'tag', name: '类型', value: tag },
        { key: 'sort', name: '排序', value: sortVals },
        { key: 'paid', name: '资费', value: paidVals },
        { key: 'clarity', name: '清晰度', value: CLARITY_FILTER }
    ];
    return {
        dianshiju: pack(areaTv, tagTv), dianying: pack(areaMovie, tagMovie),
        dongman: pack(areaAnime, tagAnime), jilupian: pack(areaMovie, tagDoc),
        shaoer: pack(areaAnime, tagKids), zongyi: pack(areaTv, tagZy)
    };
}

// ==================== 专辑列表 ====================
function requestAlbumsBody(tid, page, extend) {
    extend = extend || {};
    const idTxt = TYPE_FILTER[tid] || '电视剧';
    const offset = page < 2 ? 0 : PAGE_SIZE * (page - 1);
    const payload = {
        pinyin: tid,
        filters: {
            type: idTxt,
            area: (extend.area || '全部地区'),
            tag: (extend.tag || '全部类型'),
            sort: (extend.sort || '综合排序'),
            paid: (extend.paid || '全部资费')
        },
        offset: offset,
        limit: PAGE_SIZE
    };
    const headers = {};
    for (const k in HEADER) headers[k] = HEADER[k];
    headers['Referer'] = SITE + '/cinema/filter/' + tid + '/';
    try {
        const r = req(FILTER_API, { method: 'POST', headers: headers, data: payload, postType: 'json', timeout: 20000 });
        return (r && r.content) || '';
    } catch (e) { return ''; }
}

function parseAlbumList(jsonTxt, expectAlbumType) {
    const videos = [];
    let root;
    try { root = JSON.parse(jsonTxt); } catch (e) { return videos; }
    if (root.code !== 200) return videos;
    const albumList = (root.data && root.data.albumList) || [];
    for (const vod of albumList) {
        if (expectAlbumType > 0) {
            const types = (vod.albumTypeList || []).map(x => toInt(x, -1));
            if (types.indexOf(expectAlbumType) < 0) continue;
        }
        const title = (vod.title || '').trim();
        const albumId = vod.albumId;
        if (!title || !albumId) continue;
        const covers = vod.coverList || [];
        const pic = covers.length ? (covers[0].url || '') : '';
        let actors = vod.actorList || [];
        if (actors.length > 4) actors = actors.slice(0, 4);
        const actor = actors.map(String).join('/');
        const area = (vod.areaList || []).map(String).join('/');
        const tag = (vod.tagList || []).map(String).join('/');
        const intro = vod.intro || '';
        const year = String(vod.year || '');
        const eps = toInt(vod.totalEpisodes || vod.latestSeq, 1);
        const aweme = String(vod.AwemeItemId || '');
        const remarks = vod.subTitle || vod.bottomLabel || '';
        videos.push({
            vod_id: packId(title, albumId, actor, pic, year, area, intro, tag, eps, aweme, false),
            vod_name: title, vod_pic: pic, vod_remarks: remarks
        });
    }
    return videos;
}

function fetchAlbumsPage(tid, page, extend, expectAlbumType) {
    return parseAlbumList(requestAlbumsBody(tid, page, extend || {}), expectAlbumType || 0);
}

function fetchAlbums(tid, page, extend) {
    extend = extend || {};
    // 综艺「综合排序」整页串成电视剧, 改走最新上线
    if (tid === 'zongyi') {
        const sort = (extend.sort || '综合排序');
        if (sort === '综合排序') extend.sort = '最新上线';
    }
    const expect = ALBUM_TYPE[tid] || 0;
    if (expect <= 0) return fetchAlbumsPage(tid, page, extend, 0);
    const needSkip = Math.max(page - 1, 0) * PAGE_SIZE;
    const matched = [];
    for (let apiPage = 1; apiPage <= 30; apiPage++) {
        if (matched.length >= needSkip + PAGE_SIZE) break;
        const body = requestAlbumsBody(tid, apiPage, extend);
        const raw = parseAlbumList(body, 0);
        if (!raw.length) break;
        const filtered = parseAlbumList(body, expect);
        for (const v of filtered) matched.push(v);
    }
    return matched.slice(needSkip, needSkip + PAGE_SIZE);
}

function buildHomeVideos(limit) {
    const out = [], seen = {};
    for (const tid of ['dianshiju', 'dianying', 'zongyi', 'dongman']) {
        let rows = [];
        try { rows = fetchAlbums(tid, 1, { sort: '热度最高' }); } catch (e) {}
        if (!rows.length) { try { rows = fetchAlbums(tid, 1, {}); } catch (e) {} }
        for (const vod of rows) {
            const vid = vod.vod_id || '';
            if (!vid || seen[vid]) continue;
            seen[vid] = 1;
            out.push(vod);
            if (out.length >= limit) return out;
        }
    }
    return out;
}

// ==================== 关注/用户 ====================
function getUserid() {
    const html = fetchText(SITE + '/', HEADER, 15000);
    const m = /"identity":\{"id":"(\d+?)"/i.exec(html);
    return m ? m[1] : '';
}
function parseFollow(jsonTxt) {
    const videos = [];
    let root;
    try { root = JSON.parse(jsonTxt); } catch (e) { return videos; }
    if (root.code !== 0) return videos;
    const rows = (root.data && root.data.data) || [];
    for (const vod of rows) {
        const title = (vod.name || '').trim();
        const uid = vod.user_id;
        if (!title || !uid) continue;
        const pic = vod.avatar_url || '';
        const remarks = vod.description || '';
        videos.push({
            vod_id: packId(title, uid, title, pic, '', '', remarks, '', 1, '', true),
            vod_name: title, vod_pic: pic, vod_remarks: remarks
        });
    }
    return videos;
}
function fetchUserVideos(userId, title) {
    const root = fetchJson(SITE + '/api/videov2/author/new_video_list?to_user_id=' + userId, HEADER);
    if (root.code !== 200) return [];
    const list = (root.data && root.data.videoList) || [];
    const items = [];
    for (const v of list) {
        const gid = v.group_id;
        if (!gid) continue;
        items.push((v.title || title) + '$' + gid);
    }
    return items;
}

// ==================== 长视频接口 ====================
function fetchLvideo(albumId, episodeId) {
    let qs = 'album_id=' + albumId + '&aid=1768&format=json&query_type=0';
    if (episodeId) qs += '&episode_id=' + episodeId;
    return fetchJson(LVIDEO_API + '?' + qs, LVIDEO_HEADER, 25000);
}

function playlistFromLvideo(info, albumId) {
    const items = [];
    let cells = [];
    for (const block of info.block_list || []) {
        if (block.type === 1001) { cells = block.cells || []; break; }
    }
    if (!cells.length && info.episode) cells = [{ episode: info.episode }];
    for (const cell of cells) {
        const ep = (cell && cell.episode) || {};
        const epId = String(ep.episode_id || '');
        const seq = ep.seq;
        let title = (ep.title || ep.name || '').trim();
        if (!title) title = seq ? ('第' + seq + '集') : '正片';
        let play;
        if (!epId) {
            const vi = ep.video_info || {};
            const vid = vi.vid || '';
            if (!vid) continue;
            play = albumId + '?vid=' + vid;
        } else {
            play = albumId + '?id=' + epId;
        }
        items.push(title + '$' + play);
    }
    return items;
}

function fetchAlbumPlaylist(albumId) {
    // 移动端长视频接口优先(不受PC反爬影响)
    const items = playlistFromLvideo(fetchLvideo(albumId), albumId);
    if (items.length) return items;
    // 旧PC详情接口兜底
    const txt = fetchText(SITE + '/api/albumv2/details?albumId=' + albumId, HEADER);
    if (!txt || txt.trim().charAt(0) !== '{') return [];
    let root;
    try { root = JSON.parse(txt); } catch (e) { return []; }
    if (root.code !== 200) return [];
    const playlist = (root.data && root.data.playlist) || [];
    const out = [];
    for (const v of playlist) {
        const title = v.title || '正片';
        const ep = v.episodeId || '';
        const aid = v.albumId || albumId;
        out.push(title + '$' + (ep ? (aid + '?id=' + ep) : String(aid)));
    }
    return out;
}

function fetchAlbumInfo(albumId) {
    const info = fetchLvideo(albumId);
    const album = info.album || {};
    if (album && (album.tag_list || album.intro || album.actor_list)) {
        const covers = album.cover_list || [];
        let pic = '';
        if (covers.length) {
            pic = covers[0].url || '';
            const urls = covers[0].url_list || [];
            if (!pic && urls.length) pic = urls[0];
        }
        return {
            tags: (album.tag_list || []).join('/'),
            area: (album.area_list || []).join('/'),
            intro: album.intro || '',
            director: (album.director_list || []).filter(d => d.name).map(d => d.name).join('/'),
            actor: (album.actor_list || []).filter(a => a.name).slice(0, 6).map(a => a.name).join('/'),
            year: String(album.year || ''),
            eps: toInt(album.total_episodes || album.latest_seq, 0),
            pic: pic
        };
    }
    const txt = fetchText(SITE + '/api/albumv2/details?albumId=' + albumId, HEADER);
    if (!txt || txt.trim().charAt(0) !== '{') return {};
    let root;
    try { root = JSON.parse(txt); } catch (e) { return {}; }
    if (root.code !== 200) return {};
    const ainfo = (root.data && root.data.albumInfo) || {};
    return {
        tags: (ainfo.tagList || []).join('/'),
        area: (ainfo.areaList || []).join('/'),
        intro: ainfo.intro || '',
        director: (ainfo.directorList || []).filter(d => d.name).map(d => d.name).join('/'),
        actor: '',
        year: String(ainfo.year || '')
    };
}

function buildFallbackPlaylist(albumId, aweme, eps) {
    const target = aweme || albumId;
    if (eps <= 1) return ['正片$' + target];
    const items = [];
    const n = Math.min(Math.max(eps, 1), 120);
    for (let i = 1; i <= n; i++) items.push('第' + i + '集$' + target);
    if (eps > 120) items.push('全集$' + target);
    return items;
}

// ==================== 播放解析 ====================
function maybeB64Url(s) {
    s = String(s || '').trim();
    if (!s) return '';
    if (s.indexOf('http://') === 0 || s.indexOf('https://') === 0) return s;
    try {
        const B64C = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
        const rev = {};
        for (let i = 0; i < 64; i++) rev[B64C[i]] = i;
        const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
        const bytes = [];
        let acc = 0, bits = 0;
        for (let i = 0; i < clean.length; i++) {
            acc = (acc << 6) | rev[clean[i]];
            bits += 6;
            if (bits >= 8) { bits -= 8; bytes.push((acc >> bits) & 255); }
        }
        let out = '', i = 0;
        while (i < bytes.length) {
            const c = bytes[i++];
            if (c < 0x80) out += String.fromCharCode(c);
            else if (c < 0xE0) out += String.fromCharCode(((c & 31) << 6) | (bytes[i++] & 63));
            else if (c < 0xF0) out += String.fromCharCode(((c & 15) << 12) | ((bytes[i++] & 63) << 6) | (bytes[i++] & 63));
            else { i += 3; out += ""; }
        }
        out = out.trim();
        if (out.indexOf('http://') === 0 || out.indexOf('https://') === 0) return out;
    } catch (e) {}
    return '';
}

function pickVideoInfo(info, episodeId, vid) {
    const candidates = [];
    if (info.episode) candidates.push(info.episode);
    for (const block of info.block_list || []) {
        if (block.type !== 1001) continue;
        for (const cell of block.cells || []) candidates.push((cell && cell.episode) || {});
    }
    if (episodeId) {
        for (const ep of candidates) {
            if (String(ep.episode_id || '') === String(episodeId)) return ep.video_info || {};
        }
    }
    if (vid) {
        for (const ep of candidates) {
            const vi = ep.video_info || {};
            if (String(vi.vid || '') === String(vid)) return vi;
        }
    }
    for (const ep of candidates) {
        const vi = ep.video_info || {};
        if (vi.vid && vi.auth_token && vi.business_token) return vi;
    }
    return {};
}

function openapiVideoList(vi) {
    const vid = vi.vid || '';
    const auth = vi.auth_token || '';
    const biz = vi.business_token || '';
    if (!vid || !auth || !biz) return {};
    const qs = 'action=GetPlayInfo&video_id=' + encodeURIComponent(vid) + '&nobase64=1&ptoken=' + encodeURIComponent(biz) + '&vfrom=xgplayer';
    const headers = {
        'User-Agent': 'Mozilla/5.0',
        'Authorization': auth,
        'Origin': SITE,
        'Referer': SITE + '/',
        'Accept': 'application/json'
    };
    const root = fetchJson(PLAY_API + '?' + qs, headers, 25000);
    const data = root.data || {};
    if (data.message !== 'success' && [10, '10', 0, '0'].indexOf(data.status) < 0) return {};
    return data.video_list || {};
}

function urlOf(item) {
    return maybeB64Url((item && (item.main_url || item.backup_url_1)) || '');
}

function pickBestMainUrl(videoList) {
    if (!videoList || typeof videoList !== 'object') return '';
    const items = [];
    for (const k in videoList) {
        if (videoList[k] && typeof videoList[k] === 'object') items.push(videoList[k]);
    }
    if (!items.length) return '';
    const prefer = quality || 'auto';
    const targetDef = QUALITY_MAP[prefer];
    if (targetDef) {
        // 1) definition 精确匹配
        for (const it of items) {
            if (String(it.definition || '').toLowerCase() === targetDef) return urlOf(it);
        }
        // 2) 目标高度就近匹配
        const th = PREFER_HEIGHT[targetDef];
        if (th) {
            let best = null, bestDiff = 1 << 30;
            for (const it of items) {
                const h = toInt(it.vheight, 0);
                if (!h) continue;
                const d = Math.abs(h - th);
                if (d < bestDiff || (d === bestDiff && best && h > toInt(best.vheight, 0))) {
                    bestDiff = d; best = it;
                }
            }
            if (best) return urlOf(best);
        }
    }
    // 自动: 最高可用(4k/HDR易卡降权)
    const rank = { '4k': 4000, '1080p': 1080, '720p': 720, '540p': 540, '480p': 480, '360p': 360, normal: 400 };
    let best = null, bestScore = -1;
    for (const item of items) {
        const defn = String(item.definition || '').toLowerCase();
        let score;
        if (['4k', 'qihao', 'hdr', 'dolby'].indexOf(defn) >= 0) score = 900;
        else if (defn in rank) score = rank[defn];
        else score = Math.min(toInt(item.vheight, 0), 1080);
        if (score > bestScore) { bestScore = score; best = item; }
    }
    return best ? urlOf(best) : '';
}

function resolveLvideoPlay(albumId, episodeId, vid) {
    const info = fetchLvideo(albumId, episodeId || '');
    const vi = pickVideoInfo(info, episodeId || '', vid || '');
    if (!vi || !vi.vid) return '';
    const vl = openapiVideoList(vi);
    if (!vl) return '';
    return pickBestMainUrl(vl);
}

function resolveArticlePlay(groupId) {
    const root = fetchJson(ARTICLE_API + groupId + '/0/0/0/', { 'User-Agent': 'okhttp/3.12.1', 'Accept': 'application/json' }, 20000);
    const data = root.data || {};
    let vpi = data.video_play_info || '';
    if (!vpi) return '';
    if (typeof vpi === 'string') { try { vpi = JSON.parse(vpi); } catch (e) { return ''; } }
    const videoList = vpi.video_list || {};
    if (videoList && typeof videoList === 'object' && Object.keys(videoList).length) {
        return pickBestMainUrl(videoList);
    }
    const dyn = ((vpi.dynamic_video || {}).dynamic_video_list) || [];
    let best = null, bestH = -1;
    for (const item of dyn) {
        const h = toInt(item.vheight || item.height, 0);
        if (h >= bestH) { bestH = h; best = item; }
    }
    return best ? maybeB64Url(best.main_url || best.backup_url_1 || '') : '';
}

function resolveByGroupOrAlbum(oid) {
    const url = resolveLvideoPlay(oid, '', '');
    if (url) return url;
    return resolveArticlePlay(oid);
}

function resolveDirectPlay(raw) {
    raw = String(raw || '').trim();
    if (!raw) return '';
    // 多清晰度标记 @tag
    const atIdx = raw.lastIndexOf('@');
    if (atIdx > 0) {
        const q = raw.substring(atIdx + 1);
        if (q in QUALITY_MAP) {
            quality = q;
            raw = raw.substring(0, atIdx).trim();
        }
    }
    // 已是媒体地址
    if (raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0) {
        if (raw.indexOf('.mp4') >= 0 || raw.indexOf('.m3u8') >= 0 || raw.indexOf('video/tos') >= 0 || raw.indexOf('365yg.com') >= 0 || raw.indexOf('ixigua.com/video') >= 0) {
            if (raw.indexOf('ixigua.com/') >= 0 && raw.indexOf('/video/') < 0 && raw.indexOf('365yg') < 0) {
                // 页面URL, 继续向下抽id
            } else {
                return raw;
            }
        }
        const m = /ixigua\.com\/(?:i)?(\d+)/.exec(raw);
        if (m) return resolveByGroupOrAlbum(m[1]);
        return '';
    }
    let albumId = '', episodeId = '', vid = '';
    if (raw.indexOf('?id=') >= 0) {
        const p = raw.split('?id=');
        albumId = p[0].trim(); episodeId = (p[1] || '').trim();
    } else if (raw.indexOf('?vid=') >= 0) {
        const p = raw.split('?vid=');
        albumId = p[0].trim(); vid = (p[1] || '').trim();
    } else if (/^\d+$/.test(raw)) {
        return resolveByGroupOrAlbum(raw);
    } else {
        albumId = raw;
    }
    if (albumId) {
        const url = resolveLvideoPlay(albumId, episodeId, vid);
        if (url) return url;
    }
    if (episodeId && /^\d+$/.test(episodeId)) return resolveByGroupOrAlbum(episodeId);
    return '';
}

// 解析该分集的全清晰度 video_list (清晰度探测用)
function resolveVideoList(raw) {
    raw = String(raw || '').trim();
    if (!raw) return {};
    let albumId = '', episodeId = '', vid = '';
    if (raw.indexOf('?id=') >= 0) { const p = raw.split('?id='); albumId = p[0]; episodeId = p[1] || ''; }
    else if (raw.indexOf('?vid=') >= 0) { const p = raw.split('?vid='); albumId = p[0]; vid = p[1] || ''; }
    else albumId = raw;
    albumId = albumId.trim(); episodeId = episodeId.trim(); vid = vid.trim();
    if (albumId) {
        const vi = pickVideoInfo(fetchLvideo(albumId, episodeId), episodeId, vid);
        if (vi && vi.vid) return openapiVideoList(vi);
    }
    if (episodeId && /^\d+$/.test(episodeId)) {
        const vi = pickVideoInfo(fetchLvideo(episodeId), '', '');
        if (vi && vi.vid) return openapiVideoList(vi);
    }
    return {};
}

function detectClarities(playItems) {
    const tags = {};
    for (const it of playItems) {
        const play = it.indexOf('$') >= 0 ? it.substring(it.indexOf('$') + 1) : '';
        if (!play) continue;
        const vl = resolveVideoList(play);
        if (!vl || typeof vl !== 'object') continue;
        for (const k in vl) {
            const item = vl[k];
            if (!item || typeof item !== 'object') continue;
            const d = String(item.definition || '').toLowerCase();
            if (d && d in QUALITY_MAP) tags[d] = 1;
            else {
                const h = toInt(item.vheight, 0);
                if (h) {
                    for (const t in PREFER_HEIGHT) {
                        if (Math.abs(h - PREFER_HEIGHT[t]) <= 80) tags[t] = 1;
                    }
                }
            }
        }
        if (Object.keys(tags).length) return tags;
    }
    return tags;
}

function buildClaritySources(playItems) {
    if (!playItems.length) return ['西瓜视频', ''];
    const avail = detectClarities(playItems);
    const availEmpty = !Object.keys(avail).length;
    let tags = [];
    for (const pair of CLARITY_ORDER) {
        if (availEmpty || avail[pair[0]]) tags.push(pair[0]);
    }
    if (!tags.length) tags = CLARITY_DEFAULT_TAGS.slice();
    const names = CLARITY_ORDER.filter(p => tags.indexOf(p[0]) >= 0).map(p => p[1]);
    const groups = [];
    for (const t of tags) {
        const parts = [];
        for (const it of playItems) {
            let title = it, play = '';
            const di = it.indexOf('$');
            if (di >= 0) { title = it.substring(0, di); play = it.substring(di + 1); }
            parts.push(title + '$' + play + '@' + t);
        }
        groups.push(parts.join('#'));
    }
    return [names.join('$$$'), groups.join('$$$')];
}

// ==================== 搜索兜底: 片库扫描+索引缓存 ====================
function sliceDedup(hits, page, size) {
    size = size || 20;
    const out = [], seen = {};
    for (const vod of hits) {
        const aid = unpackId(vod.vod_id || '').albumId || '';
        if (!aid || seen[aid]) continue;
        seen[aid] = 1;
        out.push(vod);
    }
    const start = (page - 1) * size;
    return out.slice(start, start + size);
}

function searchByCatalog(key, page, quick) {
    const keyL = String(key || '').trim().toLowerCase();
    if (!keyL) return [];
    page = Math.max(toInt(page, 1), 1);
    if (!_catIndex) { _catIndex = {}; _catScanned = {}; _catDone = {}; }
    const budget = quick ? 5000 : 12000;
    const deadline = Date.now() + budget;
    const order = ['dianying', 'dianshiju', 'zongyi', 'dongman', 'jilupian', 'shaoer'];
    const indexCap = 6000;

    const hit = (vod) => {
        const name = (vod.vod_name || '').toLowerCase();
        const actor = (unpackId(vod.vod_id || '').actor || '').toLowerCase();
        return name.indexOf(keyL) >= 0 || actor.indexOf(keyL) >= 0;
    };

    // 1) 先查本地索引
    let hits = [];
    for (const aid in _catIndex) { if (hit(_catIndex[aid])) hits.push(_catIndex[aid]); }
    if (hits.length >= Math.max(page * 20, 10)) return sliceDedup(hits, page);

    // 2) 预算内继续扫描扩充索引
    for (const tid of order) {
        if (Date.now() > deadline) break;
        if (_catDone[tid]) continue;
        const start = (_catScanned[tid] || 0) + 1;
        const sort = tid === 'zongyi' ? '最新上线' : '综合排序';
        const pagesToScan = quick ? 1 : 2;
        for (let pg = start; pg < start + pagesToScan; pg++) {
            if (Date.now() > deadline) break;
            let rows = [];
            try { rows = fetchAlbumsPage(tid, pg, { sort: sort }, 0); } catch (e) {}
            if (!rows.length) { _catDone[tid] = 1; break; }
            for (const vod of rows) {
                const aid = unpackId(vod.vod_id || '').albumId || '';
                if (aid && Object.keys(_catIndex).length < indexCap) _catIndex[aid] = vod;
            }
            _catScanned[tid] = pg;
        }
    }

    // 3) 扩充后再匹配
    hits = [];
    for (const aid in _catIndex) { if (hit(_catIndex[aid])) hits.push(_catIndex[aid]); }
    return sliceDedup(hits, page);
}

function parseSearch(html) {
    const videos = [];
    let root;
    try { root = JSON.parse(html); } catch (e) { return videos; }
    if (root.code !== 0) return videos;
    const dataList = (root.data && root.data.data) || [];
    for (const row of dataList) {
        const display = row.display || {};
        const title = (display.name || '').trim();
        const epLink = display.episode_link || {};
        const albumId = String(row.album_id || display.album_id || epLink.album_id || '');
        if (!title || !albumId) continue;
        const cover = display.video_cover_info || {};
        const pic = cover.url || '';
        const actor = display.actor || '';
        const remarks = display.rating || '';
        videos.push({
            vod_id: packId(title, albumId, actor, pic, '', '', '', '', 1, '', false),
            vod_name: title, vod_pic: pic, vod_remarks: remarks
        });
    }
    return videos;
}

// ==================== TVBox 接口 ====================
function init(ext) {}

function home(filter) {
    if (!userid) {
        try { userid = getUserid() || ''; } catch (e) { userid = ''; }
    }
    const classes = CATE.map(c => ({ type_name: c[0], type_id: c[1] }));
    if (userid) classes.push({ type_name: '关注', type_id: 'follow' });
    const result = { 'class': classes };
    if (filter) result.filters = buildFilters();
    return JSON.stringify(result);
}

function homeVod() {
    try { return JSON.stringify({ list: buildHomeVideos(48) }); }
    catch (e) { return JSON.stringify({ list: [] }); }
}

function category(tid, pg, filter, extend) {
    const page = toInt(pg, 1);
    let ex = {};
    try {
        if (extend && typeof extend === 'object') ex = extend;
        else if (typeof extend === 'string' && extend) ex = JSON.parse(extend);
    } catch (e) { ex = {}; }
    if (ex.clarity) quality = ex.clarity;
    let videos = [];
    try {
        if (String(tid) === 'follow') {
            if (userid) {
                const offset = page < 2 ? 0 : 20 * page;
                const txt = fetchText(SITE + '/api/userv2/follow/list?authorId=' + userid + '&sortType=desc&cursor=' + offset, HEADER);
                videos = parseFollow(txt);
            }
        } else {
            videos = fetchAlbums(String(tid), page, ex);
        }
    } catch (e) { videos = []; }
    return JSON.stringify({
        list: videos, page: page,
        pagecount: videos.length >= PAGE_SIZE ? page + 1 : page,
        limit: PAGE_SIZE, total: videos.length
    });
}

function detail(ids) {
    if (!ids) return JSON.stringify({ list: [] });
    const rawId = Array.isArray(ids) ? ids[0] : ids;
    const meta = unpackId(rawId);
    if (!meta.albumId) return JSON.stringify({ list: [] });

    const albumId = meta.albumId;
    let { title, pic, actor, area, year, tags, intro, aweme } = meta;
    title = title || albumId;
    let eps = toInt(meta.eps, 1);
    const isUser = meta.user === '1';

    let playItems = [];
    if (isUser) {
        playItems = fetchUserVideos(albumId, title);
    } else {
        playItems = fetchAlbumPlaylist(albumId);
        if (!playItems.length) playItems = buildFallbackPlaylist(albumId, aweme, eps);
    }
    if (!playItems.length) return JSON.stringify({ list: [] });

    let director = meta.director || '';
    try {
        const info = fetchAlbumInfo(albumId);
        if (info && Object.keys(info).length) {
            tags = tags || info.tags || '';
            area = area || info.area || '';
            intro = intro || info.intro || '';
            actor = actor || info.actor || '';
            year = year || info.year || '';
            if (info.director) director = info.director;
            if (info.eps) eps = info.eps || eps;
            if (info.pic && !pic) pic = info.pic;
        }
    } catch (e) {}

    const pf = buildClaritySources(playItems);
    let content = intro || '';
    if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;
    return JSON.stringify({ list: [{
        vod_id: rawId,
        vod_name: title,
        vod_pic: pic,
        type_name: tags,
        vod_year: year,
        vod_area: area,
        vod_remarks: eps > 1 ? (eps + '集') : '',
        vod_actor: actor,
        vod_director: director,
        vod_content: content,
        vod_play_from: pf[0],
        vod_play_url: pf[1]
    }] });
}

function play(flag, id, vipFlags) {
    let raw = String(id || '').trim();
    const tail = raw.substring(raw.lastIndexOf('_') + 1);
    if (tail === 'true' || tail === 'false') raw = raw.substring(0, raw.lastIndexOf('_'));

    const playUrl = resolveDirectPlay(raw);
    if (playUrl) {
        return JSON.stringify({ parse: 0, jx: 0, playUrl: '', url: playUrl, header: PLAY_HEADER });
    }
    // 直链失败交壳内置嗅探
    let url;
    if (raw.indexOf('http://') === 0 || raw.indexOf('https://') === 0) url = raw;
    else if (raw.indexOf('?id=') >= 0) {
        const p = raw.split('?id=');
        const target = ((p[1] || '').trim() || p[0].trim());
        url = SITE + '/' + target;
    } else url = SITE + '/' + raw;
    return JSON.stringify({ parse: 1, playUrl: '', url: url, header: PLAY_HEADER });
}

function search(key, quick, pg) {
    const videos = [];
    key = String(key || '').trim();
    if (!key) return JSON.stringify({ list: videos });
    const page = toInt(pg, 1);

    // 1) 官方搜索(被Argus保护, 多数环境返回SPA壳)
    try {
        const offset = page < 2 ? 0 : (page - 1) * 10;
        const txt = fetchText(SEARCH_API + encodeURIComponent(key) + '/' + offset, HEADER);
        if (txt && txt.trim().charAt(0) === '{') {
            const vids = parseSearch(txt);
            if (vids.length) return JSON.stringify({ list: vids });
        }
    } catch (e) {}

    // 2) 片库多页标题匹配兜底
    if (quick && page > 1) return JSON.stringify({ list: videos });
    let vids = [];
    try { vids = searchByCatalog(key, page, !!quick); } catch (e) { vids = []; }
    return JSON.stringify({ list: vids });
}

export default { init, home, homeVod, category, detail, play, search };
