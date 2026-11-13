// 好看短剧 (sv.baidu.com 好看视频短剧) - QuickJS 同步版
// 分类: playletShelfFeed 动态标签; 列表: playletTagsFeed 表单
// 详情: appui/api?cmd=video/commonlist 随机设备参数 + vid 游标分页
// 播放: clarityUrl 选档直链 parse:0

const XURL = 'https://sv.baidu.com';
const MOBILE_UA = 'Mozilla/5.0 (Linux; U; Android 8.0.0; zh-cn; Mi Note 2 Build/OPR1.170623.032) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/61.0.3163.128 Mobile Safari/537.36 XiaoMi/MiuiBrowser/10.1.1';
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

const TEMPLATE_URL = 'https://sv.baidu.com/appui/api?cmd=video/commonlist&log=vhk&tn=1043677m&ctn=1043677m&blur=1&mac=&imei=AL5fB&cuid=B8B02D397EF5A5D8675FF92CDEDB833B%7C0&iid=A50-GZSWENRQHEZWMLJUHFSTALJUMYZDCLLBHEYWGLLCGZTDGNZQGBRGCOJQGE-OUABVLNI&c3_aid=A00-GGDKZORUQAP5GY6JC5BBPXTPVNC74IIA-V5QNYZSV&os=android&osbranch=a0&ua=900_1600_240&ut=V1938T_9_28_vivo&uh=vivo,qcom,V1938T&apiv=7.93.0.18&appv=793001&version=7.93.0.18&life=1773081846&clife=1773081846&nlife=1773081808&hid=empty&imsi=0&user_live_rec_source=yy,baijiahao,bjh_client,pc_client,bd_client&app_cpu_abi=64&device_prefer_abi=64&is_fold_screen=0&is_tablet=0&player_params=%7B%22ps%22:-1%7D&androidId=ec1280db12795506&zid=UW60kbyg6UiIf3uhVai1IDx_sCpGqcu19NSBuVuST5hB1Ho3bCpDReYbYo3zw3ZVdgFFLm7bHyMC7Kis_fOMAnA&network=1&sids=265_2-999990_2-999991_2-999989_2-999992_2-999988_2-999993_2-999999_72-123_2&young_mode=0&oaid=&honor_oaid=&nu=1&score=0.4330356&network5g=1&mpv=1&before_agree_sids=user_growth_15&fvt=1773081342&cp_isbg=0&is_playlet=1';
const UA_TEMPLATE = 'Mozilla/5.0 (Linux; Android 9; V1938T Build/PQ3A.190705.08061357; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/91.0.4472.114 Safari/537.36 haokan/7.93.0.18 (Baidu; P1 9)/oviv_82_9_T8391V/1043677m/B8B02D397EF5A5D8675FF92CDEDB833B%7C0/1/7.93.0.18/793001/1/immersiveMode/modeV4PlusWhite/isFirstInstall/bbqMode/bbqModeV2/blackStyle/isPlaylet';

function rndHex(n) {
    let s = '';
    for (let i = 0; i < n; i++) s += '0123456789abcdef'.charAt(Math.floor(Math.random() * 16));
    return s;
}
function randomCuid() { return rndHex(32).toUpperCase() + '%7C0'; }

// ==================== HTTP ====================
function postJson(url, obj) {
    try {
        const r = req(url, { method: 'post', data: obj, postType: 'json', headers: { 'User-Agent': MOBILE_UA }, timeout: 15000 });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
}
function postForm(url, obj) {
    try {
        const r = req(url, { method: 'post', data: obj, postType: 'form', headers: { 'User-Agent': MOBILE_UA }, timeout: 15000 });
        return JSON.parse(r.content || '');
    } catch (e) { return null; }
}

// ==================== 详情 (模板URL随机化 + 分页) ====================
function buildDetailRequest(seriesId, startVid) {
    const q = TEMPLATE_URL.split('?')[1];
    const params = {};
    const kvs = q.split('&');
    for (let i = 0; i < kvs.length; i++) {
        const eq = kvs[i].indexOf('=');
        if (eq < 0) { params[kvs[i]] = ''; continue; }
        params[kvs[i].substring(0, eq)] = decodeURIComponent(kvs[i].substring(eq + 1));
    }
    params['cuid'] = randomCuid();
    params['androidId'] = rndHex(16);
    params['zid'] = rndHex(32);
    if (params['imei']) params['imei'] = rndHex(15);
    params['iid'] = rndHex(8).toUpperCase() + '-' + rndHex(8).toUpperCase() + '-' + rndHex(8).toUpperCase() + '-' + rndHex(8).toUpperCase() + '-' + rndHex(8).toUpperCase();
    params['c3_aid'] = rndHex(3).toUpperCase() + '-' + rndHex(16).toUpperCase() + '-' + rndHex(4).toUpperCase() + '-' + rndHex(4).toUpperCase() + '-' + rndHex(4).toUpperCase() + '-' + rndHex(4).toUpperCase();
    const qs = Object.keys(params).map(k => k + '=' + encodeURIComponent(params[k])).join('&');
    const url = TEMPLATE_URL.split('?')[0] + '?' + qs;
    const ua = UA_TEMPLATE.replace(/(\/1043677m\/)([\w%]+)(\/\d+\/\d+\.\d+\.\d+\/\d+\/)/, '$1' + randomCuid() + '$3');

    const inner = [
        'source_from=kanju_shelf_playlet', 'enable_enter_playlet=0', 'seek_time=0', 'hotspot=0',
        'page_value=playlet', 'auto_show_hot_point_panel=0', 'type=playlet',
        'commonlist_id=' + Date.now(), 'scene=', 'vid=' + startVid, 'enable_atlas=0',
        'mark_pn=', 'uk=', 'ctime=0', 'from=playlet_talos', 'id=' + seriesId,
        'rn=10', 'pn=1', 'direction=3'
    ].join('&');
    const body = 'video%2Fcommonlist=' + encodeURIComponent(inner);
    return { url: url, body: body, ua: ua };
}

function fetchEpisodeBatch(seriesId, startVid) {
    const rq = buildDetailRequest(seriesId, startVid);
    try {
        const r = req(rq.url, {
            method: 'post', body: rq.body,
            headers: { 'User-Agent': rq.ua, 'Content-Type': 'application/x-www-form-urlencoded' },
            timeout: 15000
        });
        const j = JSON.parse(r.content || '');
        const ds = (j['video/commonlist'] || {}).data || {};
        const batch = ds.list || ds.results || [];
        let lastVid = '';
        for (let i = 0; i < batch.length; i++) {
            const v = (batch[i].content || {}).vid;
            if (v) lastVid = v;
        }
        return { batch: batch, hasMore: ds.has_more === 1, lastVid: lastVid };
    } catch (e) { return { batch: [], hasMore: false, lastVid: '' }; }
}

function pickClarity(clarityUrls) {
    if (clarityUrls.length > 2) return clarityUrls[2].url || '';
    if (clarityUrls.length > 1) return clarityUrls[1].url || '';
    if (clarityUrls.length > 0) return clarityUrls[0].url || '';
    return '';
}

// ==================== TVBox 接口 ====================
function init(ext) {}

function home(filter) {
    const d = postJson(XURL + '/haokan/ui-feed/playletShelfFeed', { data: JSON.stringify({ from: 'feed' }) });
    const classes = [];
    const tags = (d && d.data && d.data.playlet_tags) || [];
    for (let i = 0; i < tags.length; i++) {
        classes.push({ type_id: String(tags[i].tag_id), type_name: String(tags[i].name) });
    }
    classes.push({ type_id: '2', type_name: '新剧' });
    return JSON.stringify({ 'class': classes, filters: {} });
}

function homeVod() {
    const d = postForm(XURL + '/haokan/ui-feed/playletTagsFeed', { tag_id: '1', pn: '1', rn: '9' });
    const list = ((d && d.data && d.data.list) || []).map(v => ({
        vod_id: String(v.playlet_id || ''),
        vod_name: v.playlet_title || '',
        vod_pic: v.playlet_poster || '',
        vod_remarks: String(v.episodes_num_text || '')
    }));
    return JSON.stringify({ list: list });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const d = postForm(XURL + '/haokan/ui-feed/playletTagsFeed', { tag_id: String(tid), pn: String(page), rn: '9' });
    const list = ((d && d.data && d.data.list) || []).map(v => ({
        vod_id: String(v.playlet_id || ''),
        vod_name: v.playlet_title || '',
        vod_pic: v.playlet_poster || '',
        vod_year: String(v.hot_value || ''),
        vod_remarks: String(v.episodes_num_text || '')
    }));
    return JSON.stringify({ list: list, page: page, pagecount: 9999, limit: 90, total: 999999 });
}

function detail(ids) {
    const did = String(Array.isArray(ids) ? ids[0] : ids);
    const all = [], seen = {};
    let vid = '', rounds = 0;
    while (rounds < 40) {
        rounds++;
        const r = fetchEpisodeBatch(did, vid);
        if (!r.batch.length) break;
        let added = 0;
        for (let i = 0; i < r.batch.length; i++) {
            const v = (r.batch[i].content || {}).vid;
            if (v && !seen[v]) { seen[v] = 1; all.push(r.batch[i]); added++; }
        }
        if (r.lastVid) vid = r.lastVid; else break;
        if (!r.hasMore && added === 0) break;
        if (r.batch.length < 10 && !r.hasMore) break;
    }

    const eps = [];
    for (let i = 0; i < all.length; i++) {
        const content = all[i].content || {};
        const title = String(content.title || '').replace(/\$/g, ' ').replace(/#/g, ' ');
        const url = pickClarity(content.clarityUrl || []);
        if (url) eps.push(title + '$' + url);
    }

    return JSON.stringify({
        list: [{
            vod_id: did,
            vod_content: INTRO_PREFIX,
            vod_play_from: '好看专线',
            vod_play_url: eps.join('#')
        }]
    });
}

function search(key, quick, pg) {
    const d = postForm(XURL + '/haokan/ui-interact/playlet/search/sugs', { search_word: String(key || '') });
    const arr = (d && d.data) || [];
    const list = arr.map(v => ({
        vod_id: String(v.id || ''),
        vod_name: v.title || '',
        vod_pic: v.cover_url || '',
        vod_remarks: ''
    }));
    return JSON.stringify({ list: list, page: 1, pagecount: 1, limit: 90, total: list.length });
}

function play(flag, id, vipFlags) {
    return JSON.stringify({
        parse: 0, playUrl: '', url: String(id || ''),
        header: { 'User-Agent': MOBILE_UA }
    });
}

export default { init, home, homeVod, category, detail, search, play };
