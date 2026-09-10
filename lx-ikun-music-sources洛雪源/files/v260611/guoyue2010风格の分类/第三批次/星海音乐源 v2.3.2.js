/*! 
 * @name 星海音乐源
 * @description主API：GDAPI | 备用API：聚合接口 | ChKSz API网易云高音质
 * @version v2.3.2
 * @author 万去了了
 * @homepage https://zrcdy.dpdns.org/
 * @lastUpdate 2026-06-04
 * 
 * @version v2.3.2：优化播放
 v2.3.1更新接口，新增网易云高音质（最高母带/）
 */

// ============================ 开发者调试开关 ============================
const DEBUG_MODE = false; // true=开启全部日志  false=仅显示错误/异常/警告

// ============================ 核心配置 ============================
const UPDATE_CONFIG = {
    versionApiUrl: 'https://zrcdy.dpdns.org/lx/version.php',
    latestScriptUrl: 'https://zrcdy.dpdns.org/lx/vers.php',
    currentVersion: 'v2.3.2'
};

const STABLE_SOURCES_API_URL = 'https://zrcdy.dpdns.org/lx/stable_sources.php';
const MAIN_API_BASE = 'https://music-api.gdstudio.xyz/api.php?use_xbridge3=true&loader_name=forest&need_sec_link=1&sec_link_scene=im&theme=light';
const DIRECT_API_BASE = 'https://api.yaohud.cn/api/music/';
const SIGN_PROVIDER_URL = 'https://zrcdy.dpdns.org/lx/api/api.php?get_sign_only=1';
const FALLBACK_PROXY_URL = 'https://zrcdy.dpdns.org/lx/api/api.php';
const NETEASE_VIP_API = 'https://api.chksz.top/api/163_music';

// ============================ 全局状态 ============================
let musicSourceEnabled = true;
let serverCheckCompleted = false;
let backupApiAvailable = false;
let stableSourcesList = null;
let mainApiSourceMap = {};
let availablePlatforms = [];

// API 分平台状态
let yaohuPlatformStatus = {
    kg: 'unknown',
    qq: 'unknown',
    migu: 'unknown'
};
let gdApiStatus = 'unknown';
let neteaseVipApiStatus = 'unknown';

const ALL_PLATFORMS = ['wy', 'tx', 'kw', 'kg', 'mg'];
const MUSIC_QUALITY_FULL = {
    wy: ['128k', '192k', '320k', 'flac', 'flac24bit', 'hires', 'jyeffect', 'sky', 'jymaster'],
    tx: ['128k', '192k', '320k', 'flac', 'flac24bit'],
    kw: ['128k', '192k', '320k', 'flac', 'flac24bit'],
    kg: ['128k', '192k', '320k', 'flac', 'flac24bit'],
    mg: ['128k', '192k', '320k', 'flac', 'flac24bit']
};
const PLATFORM_NAME_MAP = {
    wy: '网易云音乐', tx: 'QQ音乐', kw: '酷我音乐', kg: '酷狗音乐', mg: '咪咕音乐'
};
const DIRECT_SOURCE_PATH = { kg: 'kg', tx: 'qq', mg: 'migu' };
const NETEASE_VIP_LEVEL_MAP = {
    'hires': 'hires', 'jyeffect': 'jyeffect', 'sky': 'sky', 'jymaster': 'jymaster'
};
const NETEASE_VIP_QUALITY_SET = new Set(['hires', 'jyeffect', 'sky', 'jymaster']);

const { EVENT_NAMES, request, on, send } = globalThis.lx;

// ============================ 工具函数 ============================
function log(...args) {
    if (!DEBUG_MODE) {
        const msg = args.join(' ');
        if (/错误|失败|异常|不可用|维护|完全失败|无结果|降级|离线|503|502|404/.test(msg)) {
            console.log('[星海]', ...args);
        }
    } else {
        console.log('[星海]', ...args);
    }
}

function delay(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
function logSimple(action, source, musicInfo, status, extra = '') {
    const songName = musicInfo.name || '未知歌曲';
    log(`[${action}] 平台:${source} | 歌曲:${songName} | 状态:${status}${extra ? ' | ' + extra : ''}`);
}

// ★ 编码前去除首尾空格，编码后去除所有 %20（空格编码）
function buildQueryString(params) {
    const parts = [];
    for (const key in params) {
        if (params.hasOwnProperty(key)) {
            let value = params[key];
            if (value !== undefined && value !== null && value !== '') {
                // 编码前删除首尾空格
                value = String(value).trim();
                // 编码
                value = encodeURIComponent(value);
                // 编码后删除所有 %20（空格编码）
                value = value.replace(/%20/g, '');
                parts.push(encodeURIComponent(key) + '=' + value);
            }
        }
    }
    return parts.join('&');
}

function mapQuality(targetQuality, availableQualities) {
    const priorityMap = {
        '臻品母带': 'jymaster', '臻品音质2.0': 'sky', '臻品音质AI': 'jyeffect',
        '臻品音质': 'jyeffect', 'Hires 无损24-Bit': 'hires', 'Hi-Res': 'hires',
        'FLAC': 'flac', '320k': '320k', '192k': '192k', '128k': '128k'
    };
    if (availableQualities.includes(targetQuality)) return targetQuality;
    const mapped = priorityMap[targetQuality];
    if (mapped && availableQualities.includes(mapped)) return mapped;
    const order = ['jymaster', 'sky', 'jyeffect', 'hires', 'flac24bit', 'flac', '320k', '192k', '128k'];
    for (const q of order) if (availableQualities.includes(q)) return q;
    return availableQualities[0] || '128k';
}

const httpFetch = (url, options = { method: 'GET' }) => {
    return new Promise((resolve, reject) => {
        const cancelRequest = request(url, options, (err, resp) => {
            if (err) return reject(new Error(`网络请求异常：${err.message}`));
            let body = resp.body;
            if (typeof body === 'string') {
                const trimmed = body.trim();
                if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
                    try { body = JSON.parse(trimmed); } catch (e) {}
                }
            }
            resolve({ body, statusCode: resp.statusCode, headers: resp.headers || {} });
        });
    });
};

const compareVersions = (remoteVer, currentVer) => {
    const parse = (v) => { const cleaned = v.replace(/^v/, ''); return cleaned.split('.').map(part => { const num = parseInt(part, 10); return isNaN(num) ? part : num; }); };
    const r = parse(remoteVer), c = parse(currentVer);
    const maxLen = Math.max(r.length, c.length);
    for (let i = 0; i < maxLen; i++) {
        const rv = r[i] !== undefined ? r[i] : (typeof c[i] === 'number' ? 0 : '');
        const cv = c[i] !== undefined ? c[i] : (typeof r[i] === 'number' ? 0 : '');
        if (typeof rv === 'number' && typeof cv === 'number') { if (rv > cv) return true; if (rv < cv) return false; }
        else if (typeof rv === 'string' && typeof cv === 'string') { if (rv > cv) return true; if (rv < cv) return false; }
        else { if (typeof rv === 'number' && typeof cv === 'string') return true; if (typeof rv === 'string' && typeof cv === 'number') return false; }
    }
    return false;
};

function trimSpacesOnly(rawName) { if (!rawName) return ''; return rawName.replace(/\s+/g, ' ').trim(); }
function removeBracketsContent(rawName) { if (!rawName) return ''; let cleaned = rawName.replace(/[（(][^）)]*[）)]/g, ''); cleaned = cleaned.replace(/\s+/g, ' ').trim(); return cleaned; }
function removeSpecialChars(rawName) { if (!rawName) return ''; let cleaned = removeBracketsContent(rawName); cleaned = cleaned.replace(/[^\u4e00-\u9fa5\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af\u1100-\u11ff\u3130-\u318fa-zA-Z0-9\s]/g, ''); cleaned = cleaned.replace(/\s+/g, ' ').trim(); return cleaned; }
function cleanStrict(rawName) { if (!rawName) return ''; let cleaned = removeSpecialChars(rawName); cleaned = cleaned.replace(/\s+/g, ''); return cleaned.trim(); }
function stringMatchScore(str1, str2) {
    if (!str1 || !str2) return 0;
    const s1 = str1.toLowerCase().replace(/\s+/g, ' ').trim();
    const s2 = str2.toLowerCase().replace(/\s+/g, ' ').trim();
    if (s1 === s2) return 1.0; if (s1.includes(s2) || s2.includes(s1)) return 0.9;
    const maxLen = Math.max(s1.length, s2.length); let matches = 0;
    for (let i = 0; i < Math.min(s1.length, s2.length); i++) { if (s1[i] === s2[i]) matches++; }
    return matches / maxLen;
}
function findBestMatchSong(originalName, originalSinger, songs) {
    if (!songs || songs.length === 0) return null;
    let bestIndex = null, bestScore = -1;
    songs.forEach((song, idx) => {
        const songName = song.title || song.name || '';
        const songSinger = song.singer || song.author || '';
        const nameScore = stringMatchScore(originalName, songName);
        const singerScore = stringMatchScore(originalSinger, songSinger);
        const totalScore = nameScore * 0.6 + singerScore * 0.4;
        if (totalScore > bestScore) { bestScore = totalScore; bestIndex = idx; }
    });
    return bestScore >= 0.3 && bestIndex !== null ? songs[bestIndex] : null;
}

// ============================ 签名凭证管理 ============================
let cachedCredential = null;
let credentialExpireTime = 0;
async function fetchCredentials() {
    const now = Date.now();
    if (cachedCredential && now < credentialExpireTime) return cachedCredential;
    log('获取临时签名凭证...');
    try {
        const resp = await httpFetch(SIGN_PROVIDER_URL, { timeout: 5000 });
        if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`);
        let data = resp.body;
        if (typeof data === 'string') data = JSON.parse(data);
        cachedCredential = data;
        const ttl = (data.expire_in ? data.expire_in - 5 : 55) * 1000;
        credentialExpireTime = now + ttl;
        return cachedCredential;
    } catch (err) {
        log('获取签名凭证失败:', err.message);
        if (cachedCredential && now < credentialExpireTime) return cachedCredential;
        throw new Error('签名凭证不可用');
    }
}

async function signedFetch(url, options = {}) {
    const cred = await fetchCredentials();
    const headers = {
        'X-Api-Key': cred.api_key,
        'X-Api-Timestamp': String(cred.timestamp),
        'X-Api-Sign': cred.sign,
        'Content-Type': 'application/json',
        ...(options.headers || {})
    };
    log(`直连请求: ${url}`);
    try {
        const resp = await httpFetch(url, { ...options, headers });
        const bodyPreview = typeof resp.body === 'string' ? resp.body : JSON.stringify(resp.body);
        log(`直连响应 [${resp.statusCode}]: ${bodyPreview.substring(0, 300)}`);
        return resp;
    } catch (e) { log(`直连请求异常: ${e.message}`); throw e; }
}

// ============================ 动态稳定源 ============================
const fetchStableSources = async () => {
    log('正在获取服务器稳定源列表...');
    try {
        const resp = await httpFetch(STABLE_SOURCES_API_URL, { method: 'GET', timeout: 5000, headers: { 'User-Agent': 'LX-Music-Mobile/星海音乐源' } });
        if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`);
        let data = resp.body; if (typeof data === 'string') data = JSON.parse(data);
        if (!Array.isArray(data) || data.length === 0) throw new Error('返回数据非数组或为空');
        stableSourcesList = data; log('✅ 稳定源列表:', stableSourcesList);
    } catch (err) {
        log('❌ 获取稳定源失败，使用默认值 [netease, kuwo]:', err.message);
        stableSourcesList = ['netease', 'kuwo'];
    }
};
const buildPlatformsFromStableSources = () => {
    const sourceToCode = { netease: 'wy', tencent: 'tx', kuwo: 'kw', kugou: 'kg', migu: 'mg' };
    mainApiSourceMap = {};
    stableSourcesList.forEach(src => { const code = sourceToCode[src]; if (code) mainApiSourceMap[code] = src; });
    availablePlatforms = [...ALL_PLATFORMS];
    log('主API支持映射:', mainApiSourceMap);
};

// ============================ 平台可用性过滤 ============================
function isPlatformAvailable(platform) {
    if (platform === 'wy') return (mainApiSourceMap['wy'] && gdApiStatus === 'available') || neteaseVipApiStatus === 'available';
    if (platform === 'kw') return mainApiSourceMap['kw'] && gdApiStatus === 'available';
    const gdOk = mainApiSourceMap[platform] && gdApiStatus === 'available';
    const directPath = DIRECT_SOURCE_PATH[platform];
    if (!directPath) return gdOk;
    const yaohuOk = (yaohuPlatformStatus[directPath] === 'available' || yaohuPlatformStatus[directPath] === 'unknown') && backupApiAvailable;
    return gdOk || yaohuOk;
}
function filterAvailablePlatforms() {
    const before = availablePlatforms.length;
    availablePlatforms = availablePlatforms.filter(p => isPlatformAvailable(p));
    log(`平台过滤完成: ${before} -> ${availablePlatforms.length}, 保留: ${availablePlatforms.join(', ')}`);
}

// ============================ 服务器状态检查 ============================
const fetchServerStatus = async () => {
    log('正在检查服务器及API状态...');
    for (let attempt = 0; attempt <= 2; attempt++) {
        if (attempt > 0) await delay(1000);
        try {
            const resp = await httpFetch(UPDATE_CONFIG.versionApiUrl, {
                method: 'GET', timeout: 5000,
                headers: { 'User-Agent': 'LX-Music-Mobile/星海音乐源' }
            });
            if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`);
            const data = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
            if (!data || typeof data !== 'object') throw new Error('无效数据格式');

            if (data.yaohu_api && data.yaohu_api.platforms) {
                const pl = data.yaohu_api.platforms;
                for (let p in pl) {
                    yaohuPlatformStatus[p] = pl[p].status || 'unknown';
                    log(`Yaohu [${p}] 状态: ${yaohuPlatformStatus[p]} (${pl[p].message})`);
                }
            } else {
                const overall = data.yaohu_api?.status || 'unknown';
                for (let p in yaohuPlatformStatus) yaohuPlatformStatus[p] = overall;
                log(`Yaohu API 整体状态: ${overall}`);
            }

            if (data.gd_api) {
                gdApiStatus = data.gd_api.status || 'unknown';
                log(`GD API 状态: ${gdApiStatus} (${data.gd_api.message})`);
            } else gdApiStatus = 'unknown';

            if (data.netease_vip_api) {
                neteaseVipApiStatus = data.netease_vip_api.status || 'unknown';
                log(`网易云VIP API 状态: ${neteaseVipApiStatus} (${data.netease_vip_api.message})`);
            } else neteaseVipApiStatus = 'unknown';

            const online = data.server_status?.online !== false;
            backupApiAvailable = online;
            log(`服务器代理状态: ${online ? '在线' : '离线'}`);
            return { enabled: online, message: online ? '服务正常' : '服务器离线', remoteVersion: data.version || null };
        } catch (err) {
            log(`状态检查失败(第${attempt + 1}次):`, err.message);
        }
    }
    for (let p in yaohuPlatformStatus) yaohuPlatformStatus[p] = 'unavailable';
    gdApiStatus = 'unavailable';
    neteaseVipApiStatus = 'unavailable';
    backupApiAvailable = false;
    return { enabled: false, message: '服务器连接失败，使用本地模式', remoteVersion: null };
};

// ============================ 搜索与匹配 ============================
function extractSongsFromData(data, upstreamSource) {
    if (!data || data.code !== 200) return [];
    if (upstreamSource === 'qq' || upstreamSource === 'tx') return data.data?.songs || [];
    if (Array.isArray(data.data)) return data.data;
    if (data.data?.songs) return data.data.songs;
    return [];
}

function isDefinitelyNoResult(responseBody) {
    if (!responseBody) return false;
    const data = typeof responseBody === 'object' ? responseBody : JSON.parse(responseBody);
    return data && data.code === 404 && data.data && Array.isArray(data.data) && data.data.length === 0;
}

async function directSearch(upstreamSource, keyword, limit = 10) {
    const params = { key: '8Sbg8jJCnrssIDGDaz9', msg: keyword, g: String(limit) };
    if (upstreamSource === 'migu') { params.num = String(limit); delete params.g; }
    const url = `${DIRECT_API_BASE}${upstreamSource}?${buildQueryString(params)}`;
    log(`直连搜索(${limit}首): ${url}`);
    try {
        const resp = await signedFetch(url);
        if (resp.statusCode !== 200) return [];
        const data = resp.body;
        if (data.code !== 200) {
            if (isDefinitelyNoResult(data)) throw new Error('NO_RESULT');
            return [];
        }
        const songs = extractSongsFromData(data, upstreamSource);
        if (songs.length === 0 && isDefinitelyNoResult(data)) throw new Error('NO_RESULT');
        return songs;
    } catch (e) {
        if (e.message === 'NO_RESULT') throw e;
        return [];
    }
}

async function proxySearch(proxySource, keyword, limit = 10) {
    if (!proxySource) throw new Error('代理搜索缺少source参数');
    const params = { source: proxySource, msg: keyword, g: String(limit) };
    if (proxySource === 'migu') { params.num = String(limit); delete params.g; }
    const url = `${FALLBACK_PROXY_URL}?${buildQueryString(params)}`;
    log(`代理搜索(${limit}首): ${url}`);
    try {
        const resp = await httpFetch(url);
        if (resp.statusCode !== 200) return [];
        const data = resp.body;
        if (data.code !== 200) {
            if (isDefinitelyNoResult(data)) throw new Error('NO_RESULT');
            return [];
        }
        const songs = extractSongsFromData(data, proxySource);
        if (songs.length === 0 && isDefinitelyNoResult(data)) throw new Error('NO_RESULT');
        return songs;
    } catch (e) {
        if (e.message === 'NO_RESULT') throw e;
        return [];
    }
}

async function smartSearchBestMatch(source, songName, singer, useProxy = false) {
    const upstreamSource = DIRECT_SOURCE_PATH[source];
    if (!upstreamSource) throw new Error('不支持直连/代理的平台');
    const searchFunc = useProxy ? proxySearch : directSearch;

    const cleanSong = removeSpecialChars(songName);
    const cleanSinger = removeSpecialChars(singer || '');

    let songs = [];
    let definiteNoResult = false;
    try {
        songs = await searchFunc(upstreamSource, songName, 20);
    } catch (e) {
        if (e.message === 'NO_RESULT') definiteNoResult = true;
    }
    if (!definiteNoResult && songs.length > 0) {
        const best = findBestMatchSong(songName, singer, songs);
        if (best) return best;
    }

    if (cleanSong !== songName) {
        try {
            songs = await searchFunc(upstreamSource, cleanSong, 20);
        } catch (e) {
            if (e.message === 'NO_RESULT') definiteNoResult = true;
        }
        if (!definiteNoResult && songs.length > 0) {
            const best = findBestMatchSong(songName, singer, songs);
            if (best) return best;
        }
    }

    if (cleanSinger) {
        const combined = cleanSong + ' ' + cleanSinger;
        try {
            songs = await searchFunc(upstreamSource, combined, 30);
        } catch (e) {
            if (e.message === 'NO_RESULT') definiteNoResult = true;
        }
        if (!definiteNoResult && songs.length > 0) {
            const best = findBestMatchSong(songName, singer, songs);
            if (best) return best;
        }
    }

    return null;
}

function isDirectAllowedForSource(source) {
    const upstream = DIRECT_SOURCE_PATH[source];
    if (!upstream) return false;
    const status = yaohuPlatformStatus[upstream] || 'unknown';
    return status === 'available' || status === 'unknown';
}

// ============================ 音频地址获取 ============================
async function getMusicUrlFromMainAPI(source, songId, apiQuality) {
    if (gdApiStatus !== 'available') throw new Error('GD API 不可用');
    const apiSource = mainApiSourceMap[source];
    if (!apiSource) throw new Error('主API不支持此平台');
    const url = `${MAIN_API_BASE}&types=url&source=${apiSource}&id=${songId}&br=${apiQuality}`;
    const resp = await httpFetch(url, { headers: { 'User-Agent': 'LX-Music-Mobile', 'Accept': 'application/json' } });
    const data = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
    if (!data.url) throw new Error('主API未返回音频地址');
    return data.url;
}

async function getMusicUrlFromNeteaseVIP(songId, quality) {
    if (neteaseVipApiStatus !== 'available') throw new Error('网易云VIP API 不可用');
    const level = NETEASE_VIP_LEVEL_MAP[quality] || 'jymaster';
    const url = `${NETEASE_VIP_API}?id=${songId}&level=${level}`;
    const resp = await httpFetch(url, { headers: { 'User-Agent': 'LX-Music-Mobile', 'Accept': 'application/json' } });
    if (resp.statusCode !== 200) throw new Error(`网易云VIP HTTP ${resp.statusCode}`);
    const data = typeof resp.body === 'object' ? resp.body : JSON.parse(resp.body);
    if (data.code !== 200 || !data.data?.url) throw new Error(data.msg || '网易云VIP接口未返回音频地址');
    return data.data.url;
}

async function getMusicUrlViaDirect(source, musicInfo, quality) {
    if (!isDirectAllowedForSource(source)) throw new Error(`Yaohu ${DIRECT_SOURCE_PATH[source]} 不可用，跳过直连`);
    const songName = musicInfo.name || '';
    const singer = musicInfo.singer || '';
    if (!songName) throw new Error('歌曲信息缺失');
    const upstreamSource = DIRECT_SOURCE_PATH[source];

    const bestSong = await smartSearchBestMatch(source, songName, singer, false);
    if (!bestSong) throw new Error('直连搜索未找到匹配歌曲');

    const bestN = bestSong.n || bestSong.index || 1;
    const detailParams = { key: '8Sbg8jJCnrssIDGDaz9', msg: songName, n: String(bestN) };
    if (source === 'kg') detailParams.quality = 'flac';
    else if (source === 'tx') detailParams.size = 'hq';
    const detailUrl = `${DIRECT_API_BASE}${upstreamSource}?${buildQueryString(detailParams)}`;
    log(`直连详情请求: ${detailUrl}`);
    const detailResp = await signedFetch(detailUrl);
    if (detailResp.statusCode !== 200) throw new Error(`详情请求失败`);
    const detail = detailResp.body;
    if (detail.code !== 200) throw new Error(detail.msg || '获取详情失败');
    const data = detail.data;
    const url = data?.play_url || data?.music_url || data?.url || data?.musicurl;
    if (!url) throw new Error('未找到音频地址');
    return url;
}

async function getMusicUrlViaProxy(source, musicInfo, quality) {
    if (!backupApiAvailable) throw new Error('备用代理不可用');
    const proxySource = DIRECT_SOURCE_PATH[source];
    if (!proxySource) throw new Error('该平台无代理映射');
    const songName = musicInfo.name || '';
    const singer = musicInfo.singer || '';
    if (!songName) throw new Error('歌曲信息缺失');

    const bestSong = await smartSearchBestMatch(source, songName, singer, true);
    if (!bestSong) throw new Error('代理搜索未找到匹配歌曲');

    const bestN = bestSong.n || bestSong.index || 1;
    const detailParams = { source: proxySource, msg: songName, n: String(bestN) };
    if (proxySource === 'kg') detailParams.quality = 'flac';
    else if (proxySource === 'qq') detailParams.size = 'hq';
    const detailUrl = `${FALLBACK_PROXY_URL}?${buildQueryString(detailParams)}`;
    log(`代理详情请求: ${detailUrl}`);
    const detailResp = await httpFetch(detailUrl);
    if (detailResp.statusCode !== 200) throw new Error(`代理详情请求失败`);
    const detail = detailResp.body;
    if (detail.code !== 200) throw new Error(detail.msg || '获取详情失败');
    const data = detail.data;
    const url = data?.play_url || data?.music_url || data?.url || data?.musicurl;
    if (!url) throw new Error('代理未返回音频地址');
    return url;
}

const handleGetMusicUrl = async (source, musicInfo, quality) => {
    if (!musicSourceEnabled) throw new Error('服务暂时不可用');
    if (!serverCheckCompleted) throw new Error('服务初始化中，请稍后');
    const songId = musicInfo.hash ?? musicInfo.songmid ?? musicInfo.id;
    if (!songId) throw new Error('歌曲信息不完整');
    logSimple('解析音频地址', source, musicInfo, '开始');
    const avail = MUSIC_QUALITY_FULL[source] || ['128k', '192k', '320k', 'flac'];
    let actual = mapQuality(quality, avail);
    if (actual !== quality) log(`音质自动映射: ${quality} -> ${actual}`);
    let finalUrl = null, lastErr = null;

    if (source === 'wy' && NETEASE_VIP_QUALITY_SET.has(actual)) {
        if (neteaseVipApiStatus === 'available') {
            try {
                finalUrl = await getMusicUrlFromNeteaseVIP(songId, actual);
                logSimple('解析音频地址', source, musicInfo, '成功(网易云VIP)');
                return finalUrl;
            } catch (err) {
                lastErr = err;
                log('网易云VIP请求失败，回退到GDAPI或备用', err.message);
                actual = 'flac24bit';
            }
        } else {
            log(`网易云VIP API 状态为 ${neteaseVipApiStatus}，跳过，回退到GDAPI`);
            actual = 'flac24bit';
        }
    }

    if (mainApiSourceMap[source] && gdApiStatus === 'available') {
        try {
            const brMap = { '128k': '128', '192k': '192', '320k': '320', 'flac': '740', 'flac24bit': '999' };
            finalUrl = await getMusicUrlFromMainAPI(source, songId, brMap[actual] || '320');
            logSimple('解析音频地址', source, musicInfo, '成功(GDAPI)');
        } catch (err) {
            lastErr = err;
            log('GDAPI失败，尝试备用', err.message);
        }
    } else {
        log(`GD API 状态为 ${gdApiStatus} 或平台不支持，跳过`);
    }

    if (!finalUrl && DIRECT_SOURCE_PATH[source] && backupApiAvailable) {
        const directAllowed = isDirectAllowedForSource(source);
        if (directAllowed) {
            try {
                finalUrl = await getMusicUrlViaDirect(source, musicInfo, actual);
                logSimple('解析音频地址', source, musicInfo, '成功(直连)');
            } catch (err) {
                lastErr = err;
                log('直连失败，尝试代理备用', err.message);
                try {
                    finalUrl = await getMusicUrlViaProxy(source, musicInfo, actual);
                    logSimple('解析音频地址', source, musicInfo, '成功(代理备用)');
                } catch (err2) { lastErr = err2; }
            }
        } else {
            log(`Yaohu ${DIRECT_SOURCE_PATH[source]} 不可用，直接走代理`);
            try {
                finalUrl = await getMusicUrlViaProxy(source, musicInfo, actual);
                logSimple('解析音频地址', source, musicInfo, '成功(代理备用)');
            } catch (err) { lastErr = err; }
        }
    } else if (!finalUrl && backupApiAvailable && !DIRECT_SOURCE_PATH[source]) {
        lastErr = new Error('无可用备用来源');
        log('无直连/代理映射，无法获取');
    }

    if (!finalUrl) {
        const msg = `无法获取音频地址：${lastErr ? lastErr.message : '未知错误'}`;
        logSimple('解析音频地址', source, musicInfo, '完全失败', msg);
        throw new Error(msg);
    }
    return finalUrl;
};

// ============================ 搜索功能 ============================
async function handleSearch(source, info) {
    if (!backupApiAvailable) throw new Error('搜索功能暂不可用（服务器离线）');
    if (!['kg', 'tx', 'mg'].includes(source)) throw new Error(`平台 ${source} 暂不支持搜索`);

    const keyword = info.key || info.keyword || '';
    if (!keyword) throw new Error('请输入搜索关键词');
    const limit = info.limit || 20;
    const upstreamSource = DIRECT_SOURCE_PATH[source];

    const directAllowed = isDirectAllowedForSource(source);
    if (directAllowed) {
        const params = { key: '8Sbg8jJCnrssIDGDaz9', msg: keyword, g: String(limit) };
        if (upstreamSource === 'migu') { params.num = String(limit); delete params.g; }
        const url = `${DIRECT_API_BASE}${upstreamSource}?${buildQueryString(params)}`;
        log(`直连搜索: ${url}`);
        try {
            const resp = await signedFetch(url);
            if (resp.statusCode !== 200) throw new Error(`HTTP ${resp.statusCode}`);
            const data = resp.body;
            if (data.code !== 200) throw new Error(data.msg || '搜索失败');
            const songs = extractSongsFromData(data, upstreamSource);
            const list = songs.map((item, index) => ({
                singer: item.singer || item.author || '',
                name: item.title || item.name || '',
                album: item.album || item.albumname || '',
                source,
                songmid: item.hash || item.mid || item.id || String(index),
                interval: item.duration ? Math.floor(parseInt(item.duration) * 1000) : null,
                img: item.cover || item.picture || '',
                lrc: null, hash: item.hash || item.mid || item.id || String(index),
                albumId: item.albumid || '', lyricUrl: null
            }));
            return { list, total: songs.length, limit, page: info.page || 1, source };
        } catch (err) {
            log('直连搜索失败，降级到代理搜索:', err.message);
        }
    } else {
        log(`Yaohu ${upstreamSource} 不可用，直接走代理搜索`);
    }
    return searchViaProxy(source, info);
}

async function searchViaProxy(source, info) {
    const keyword = info.key || info.keyword || '';
    const limit = info.limit || 20;
    const proxySource = DIRECT_SOURCE_PATH[source];
    if (!proxySource) throw new Error('无代理映射');
    const params = { source: proxySource, msg: keyword, g: String(limit) };
    if (proxySource === 'migu') { params.num = String(limit); delete params.g; }
    const url = `${FALLBACK_PROXY_URL}?${buildQueryString(params)}`;
    log(`代理搜索: ${url}`);
    const resp = await httpFetch(url);
    if (resp.statusCode !== 200) throw new Error(`代理搜索 HTTP ${resp.statusCode}`);
    const data = resp.body;
    if (data.code !== 200) throw new Error(data.msg || '搜索失败');
    const songs = extractSongsFromData(data, proxySource);
    const list = songs.map((item, index) => ({
        singer: item.singer || item.author || '',
        name: item.title || item.name || '',
        album: item.album || item.albumname || '',
        source,
        songmid: item.hash || item.mid || item.id || String(index),
        interval: item.duration ? Math.floor(parseInt(item.duration) * 1000) : null,
        img: item.cover || item.picture || '',
        lrc: null, hash: item.hash || item.mid || item.id || String(index),
        albumId: item.albumid || '', lyricUrl: null
    }));
    return { list, total: songs.length, limit, page: info.page || 1, source };
}

// ============================ 构建音乐源对象 ============================
const buildMusicSources = (platforms) => {
    const sources = {};
    platforms.forEach(code => { sources[code] = { name: PLATFORM_NAME_MAP[code] || code, type: 'music', actions: ['musicUrl'], qualitys: MUSIC_QUALITY_FULL[code] }; });
    return sources;
};

// ============================ 事件监听 ============================
on(EVENT_NAMES.request, ({ action, source, info }) => {
    if (action === 'musicUrl') {
        if (!info?.musicInfo || !info.type) return Promise.reject(new Error('请求参数不完整'));
        return handleGetMusicUrl(source, info.musicInfo, info.type);
    } else if (action === 'search') {
        if (!info) return Promise.reject(new Error('搜索参数缺失'));
        return handleSearch(source, info);
    } else return Promise.reject(new Error('不支持的操作类型'));
});

// ============================ 初始化 ============================
(async () => {
    log('========================================');
    log('星海音乐源 v2.3.2 签名直连版 初始化');
    log('========================================');
    try {
        const server = await fetchServerStatus();
        musicSourceEnabled = server.enabled;
        backupApiAvailable = server.enabled;
        await fetchStableSources();
        buildPlatformsFromStableSources();
        filterAvailablePlatforms();
        fetchCredentials().catch(() => {});
        serverCheckCompleted = true;
        const sources = buildMusicSources(availablePlatforms);
        send(EVENT_NAMES.inited, { status: true, openDevTools: false, sources, initStatus: 'ready' });
        log('✅ 初始化完成，可用平台:', availablePlatforms.join(', '));
        setTimeout(() => checkAutoUpdate(), 3000);
    } catch (err) {
        log('❌ 初始化异常，进入降级模式:', err.message);
        stableSourcesList = ['netease', 'kuwo'];
        buildPlatformsFromStableSources();
        filterAvailablePlatforms();
        musicSourceEnabled = true;
        backupApiAvailable = false;
        serverCheckCompleted = true;
        const sources = buildMusicSources(availablePlatforms);
        send(EVENT_NAMES.inited, { status: true, openDevTools: false, sources, initStatus: 'degraded' });
        log('降级模式完成，部分功能可能不可用，保留平台:', availablePlatforms.join(', '));
        setTimeout(() => checkAutoUpdate(), 3000);
    }
})();

async function checkAutoUpdate() {
    if (!musicSourceEnabled) return;
    try {
        const resp = await httpFetch(UPDATE_CONFIG.versionApiUrl, {
            timeout: 10000,
            headers: { 'Content-Type': 'application/json', 'User-Agent': 'LX-Music-Mobile' }
        });
        if (resp.statusCode !== 200) return;
        let data = resp.body;
        if (typeof data === 'string') { try { data = JSON.parse(data.trim().replace(/^\uFEFF/, '')); } catch (e) { return; } }
        const remoteVer = data.version;
        if (!remoteVer) return;
        const needUpdate = data.need_update !== undefined ? data.need_update : compareVersions(remoteVer, UPDATE_CONFIG.currentVersion);
        if (needUpdate) {
            const updateUrl = data.update_url || UPDATE_CONFIG.latestScriptUrl;
            send(EVENT_NAMES.updateAlert, {
                log: `【星海音乐源更新通知】\n当前版本：${UPDATE_CONFIG.currentVersion}\n最新版本：${remoteVer}\n\n更新内容：\n${data.changelog || '暂无'}`,
                updateUrl,
                confirmText: '立即更新',
                cancelText: '暂不更新'
            });
        }
    } catch (err) { log('更新检查失败:', err.message); }
}