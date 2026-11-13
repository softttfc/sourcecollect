// TVB云播 (www.viptvb07.com, MacCMS+mytheme) - QuickJS 琉芸版
// 反爬: 全站带 X-Requested-With: XMLHttpRequest 过滑动验证; 响应可能是 JSON 包裹的 HTML, 自动解包
// 播放: player_data -> 直链 parse:0 / 令牌走 jx.hktvyb.top 解析链 / 兜底 parse:1
// ext 可传自定义域名覆盖默认 host

const DEF_HOST = 'http://www.viptvb07.com';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const JX_HOST = 'http://jx.hktvyb.top';
const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';

const JX_PARSE = {
    'zijianm3u8': '/index2.php?url=', 'vwnet': '/index3.php?url=', 'co': '/index3.php?url=',
    'yunjie': '/index3.php?url=', 'NSYS': '/index3.php?url=', 'CO4K': '/index3.php?url=',
    'mp4': '/index.php?url=', 'mytvb': '/index.php?url=', '13yun': '/index.php?url=',
    '189d': '/index.php?url=', 'hkm3u8': '/index.php?url=', 'mytv': '/hktvua.php?url=',
    'dbm3u8': '/indexzy.php?url=', 'bfzym3u8': '/indexzy.php?url=', '1080zyk': '/indexzy.php?url=',
    'ffm3u8': '/indexzy.php?url=', 'lzm3u8': '/indexzy.php?url=', 'xun4k': '/indexzy.php?url=',
    'wsym3u8': 'http://104.233.148.69:666/xun.php?url='
};
const JX_FALLBACK = ['/index3.php?url=', '/index.php?url=', '/indexzy.php?url=', '/index2.php?url='];

const CATEGORIES = [['1', '电影'], ['2', '剧集'], ['3', '综艺'], ['4', '动漫'], ['5', '短剧']];
const SUBS = {
    '1': [['6', '动作片'], ['7', '喜剧片'], ['8', '爱情片'], ['9', '科幻片'], ['10', '剧情片'], ['11', '恐怖片'], ['12', '战争片']],
    '2': [['13', '国产剧'], ['14', '港台剧'], ['15', '日韩剧'], ['16', '欧美剧'], ['20', '海外剧']],
    '3': [['21', '大陆综艺'], ['22', '香港综艺'], ['23', '日韩综艺'], ['24', '欧美综艺']],
    '4': [['25', '国产动漫'], ['26', '日韩动漫'], ['27', '港台动漫'], ['28', '欧美动漫']],
    '5': [['29', '漫剧'], ['30', '玄幻'], ['31', '剧情'], ['32', '权谋'], ['33', '豪门'], ['34', '宫斗'], ['35', '脑洞'], ['36', '科幻'], ['37', '仙侠'], ['38', '悬疑'], ['39', '爱情'], ['40', 'AI漫剧'], ['41', '女性成长'], ['42', '旧短剧']]
};
const SORTS = [['按时间', 'time'], ['按人气', 'hits'], ['按评分', 'score']];
const FALLBACK_DIM = {
    '1': { 'class': ['儿童', '冒险', '农村', '剧情', '动作', '动画', '历史', '古装', '喜剧', '奇幻', '微电影', '恐怖', '悬疑', '惊悚', '战争', '文艺', '枪战', '武侠', '爱情', '犯罪', '科幻', '经典', '网络电影', '警匪', '运动', '青春'], 'area': ['其他', '加拿大', '印度', '台湾', '大陆', '德国', '意大利', '日本', '法国', '泰国', '美国', '英国', '西班牙', '韩国', '香港'], 'lang': ['其它', '国语', '德语', '日语', '法语', '粤语', '英语', '闽南语', '韩语'] },
    '2': { 'class': ['乡村', '其他', '剧情', '动作', '历史', '古装', '商战', '喜剧', '奇幻', '家庭', '情景', '战争', '犯罪', '经典', '网剧', '青春偶像'], 'area': ['其他', '台湾', '大陆', '新加坡', '日本', '泰国', '美国', '英国', '韩国', '香港'], 'lang': ['其它', '国语', '日语', '粤语', '英语', '闽南语', '韩语'] },
    '3': { 'class': ['情感', '播报', '旅游', '曲艺', '求职', '游戏互动', '生活', '纪实', '美食', '访谈', '财经', '选秀', '音乐'], 'area': ['其他', '台湾', '大陆', '新加坡', '日本', '泰国', '美国', '英国', '韩国', '香港'], 'lang': ['其它', '国语', '日语', '粤语', '英语', '闽南语', '韩语'] },
    '4': { 'class': ['亲子', '其他', '冒险', '动作', '励志', '原创', '少女', '少年', '情感', '战争', '推理', '搞笑', '机战', '校园', '热血', '益智', '社会', '科幻', '萝莉', '运动'], 'area': ['其他', '国产', '日本', '欧美'], 'lang': ['其它', '国语', '日语', '粤语', '英语', '闽南语', '韩语'] },
    '5': { 'class': ['儿童', '冒险', '农村', '剧情', '动作', '动画', '历史', '古装', '喜剧', '奇幻', '微电影', '恐怖', '悬疑', '惊悚', '战争', '文艺', '枪战', '武侠', '爱情', '犯罪', '科幻', '经典', '网络电影', '警匪', '运动', '青春'], 'area': ['其他', '加拿大', '印度', '台湾', '大陆', '德国', '意大利', '日本', '法国', '泰国', '美国', '英国', '西班牙', '韩国', '香港'], 'lang': ['其它', '国语', '德语', '日语', '法语', '粤语', '英语', '闽南语', '韩语'] }
};

let HOST = DEF_HOST;
const filterCache = {};
let lastSearch = 0;

// ==================== 基础工具 ====================
function headers(referer) {
    return {
        'User-Agent': UA,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'X-Requested-With': 'XMLHttpRequest',
        'Referer': referer || (HOST + '/index.php')
    };
}

function unwrap(text) {
    if (!text) return '';
    const t = text.trim();
    if (t.charAt(0) === '"') {
        try {
            const dec = JSON.parse(t);
            if (typeof dec === 'string' && dec) return dec;
        } catch (e) {}
    }
    return text;
}

function isRateLimited(body) {
    return !!body && (body.indexOf('请不要频繁操作') >= 0 || body.indexOf('搜索时间间隔') >= 0);
}

function httpGet(url, referer, retries) {
    let last = '';
    for (let i = 0; i < (retries || 3); i++) {
        try {
            const r = req(url, { headers: headers(referer), timeout: 20000 });
            if (r && r.content) {
                if (isRateLimited(r.content)) { last = ''; break; }
                const text = unwrap(r.content);
                if (text && text.trim().length > 200) return text;
                last = text;
            }
        } catch (e) {}
    }
    return last;
}

function stripTags(s) {
    s = String(s || '').replace(/<[^>]+>/g, '');
    s = s.split('&nbsp;').join(' ').split('&amp;').join('&').split('&lt;').join('<')
        .split('&gt;').join('>').split('&quot;').join('"').split('&#39;').join("'");
    return s.replace(/\s+/g, ' ').trim();
}

function fixUrl(u) {
    if (!u) return '';
    u = u.trim();
    if (u.indexOf('//') === 0) return 'https:' + u;
    if (u.indexOf('http') === 0) return u;
    if (u.charAt(0) === '/') return HOST + u;
    return HOST + '/' + u;
}

function normTid(tid) {
    const t = String(tid || '').trim();
    const m = /\/vod\/(?:type|show)\/id\/(\d+)/.exec(t);
    if (m) return m[1];
    if (/^\d+$/.test(t)) return t;
    return '2';
}

function isVideoFormat(url) {
    const low = String(url || '').toLowerCase();
    return ['.m3u8', '.mp4', '.flv', '.mkv', '.avi', '.ts'].some(k => low.indexOf(k) >= 0);
}

// ==================== 列表解析 ====================
function parseList(html, containerOnly) {
    const vods = [], seen = {};
    if (!html) return vods;
    const harvest = (seg) => {
        const liRe = /<li[^>]*>([\s\S]*?)<\/li>/g;
        let block;
        while ((block = liRe.exec(seg)) !== null) {
            const b = block[1];
            let m = /<a class="myui-vodlist__thumb[^"]*"[^>]*href="(\/index\.php\/vod\/detail\/id\/(\d+)\.html)"[^>]*title="([^"]*)"(?:[^>]*data-original="([^"]*)")?/.exec(b);
            if (!m) m = /href="(\/index\.php\/vod\/detail\/id\/(\d+)\.html)"[^>]*title="([^"]*)"(?:[^>]*data-original="([^"]*)")?/.exec(b);
            if (!m) continue;
            const vid = m[2];
            if (!vid || seen[vid]) continue;
            const name = stripTags(m[3]);
            if (!name) continue;
            let pic = m[4] || '';
            if (!pic) {
                let mp = /data-original="([^"]+)"/.exec(b);
                if (!mp) mp = /<img[^>]*src="([^"]+)"/.exec(b);
                if (mp) pic = mp[1];
            }
            let remark = '';
            const rm = /class="pic-tag[^"]*">\s*<span class="tag"[^>]*>([\s\S]*?)<\/span>/.exec(b);
            if (rm) remark = stripTags(rm[1]);
            seen[vid] = 1;
            vods.push({ vod_id: vid, vod_name: name, vod_pic: fixUrl(pic), vod_remarks: remark });
        }
    };
    if (containerOnly !== false) {
        let seg = html;
        const i = html.indexOf('<!-- 筛选 -->');
        if (i >= 0) seg = html.substring(i);
        const m = /<ul class="myui-vodlist clearfix">([\s\S]*?)<\/ul>/.exec(seg);
        harvest(m ? m[1] : '');
    } else {
        const re = /<ul class="myui-vodlist clearfix">([\s\S]*?)<\/ul>/g;
        let m;
        while ((m = re.exec(html)) !== null) harvest(m[1]);
    }
    return vods;
}

function parsePagecount(html, page) {
    page = parseInt(page, 10) || 1;
    if (!html) return page;
    const re = /\/page\/(\d+)\.html/g;
    let m, max = 0;
    while ((m = re.exec(html)) !== null) { const n = parseInt(m[1], 10); if (n > max) max = n; }
    return max > 0 ? Math.max(max, page) : page;
}

// ==================== 筛选器 (动态抓取+兜底) ====================
function parseScreen(html, tid) {
    const groups = {};
    if (!html) return groups;
    const dimPats = [
        ['class', new RegExp('/vod/show/class/([^/]+)/id/' + tid + '\\.html$')],
        ['area', new RegExp('/vod/show/area/([^/]+)/id/' + tid + '\\.html$')],
        ['year', new RegExp('/vod/show/id/' + tid + '/year/([^/]+)\\.html$')],
        ['lang', new RegExp('/vod/show/id/' + tid + '/lang/([^/]+)\\.html$')],
        ['by', new RegExp('/vod/show/by/([^/]+)/id/' + tid + '\\.html$')]
    ];
    const subPat = /\/vod\/show\/id\/(\d+)\.html$/;
    const ulRe = /<ul class="myui-screen__list[^"]*"[^>]*>([\s\S]*?)<\/ul>/g;
    let block;
    while ((block = ulRe.exec(html)) !== null) {
        const linkRe = /href="(\/index\.php\/vod\/show\/[^"]+\.html)"[^>]*>([\s\S]*?)<\/a>/g;
        const links = [];
        let lm;
        while ((lm = linkRe.exec(block[1])) !== null) links.push([lm[1], lm[2]]);
        if (!links.length) continue;
        let dim = null;
        const vals = [], subVals = [];
        for (let i = 0; i < links.length; i++) {
            const u = links[i][0], t = stripTags(links[i][1]);
            if (!t) continue;
            let hit = null;
            for (let d = 0; d < dimPats.length; d++) {
                const m = dimPats[d][1].exec(u);
                if (m) { hit = [dimPats[d][0], m[1]]; break; }
            }
            if (hit) {
                if (dim === null) dim = hit[0];
                if (hit[0] === dim) vals.push({ n: t, v: hit[1] });
                continue;
            }
            const sm = subPat.exec(u);
            if (sm && sm[1] !== String(tid)) subVals.push({ n: t, v: sm[1] });
        }
        if (dim && vals.length) groups[dim] = vals;
        else if (subVals.length) groups['sub'] = [{ n: '全部', v: '' }].concat(subVals);
    }
    return groups;
}

function fallbackFilters(tid) {
    const base = FALLBACK_DIM[tid] || FALLBACK_DIM['1'];
    const groups = {};
    ['class', 'area', 'lang'].forEach(dim => {
        const vals = base[dim] || FALLBACK_DIM['1'][dim];
        groups[dim] = [{ n: '全部', v: '' }].concat(vals.map(x => ({ n: x, v: encodeURIComponent(x) })));
    });
    const years = [];
    for (let y = 2026; y >= 2000; y--) years.push(String(y));
    groups['year'] = [{ n: '全部', v: '' }].concat(years.map(y => ({ n: y, v: y })));
    groups['by'] = SORTS.map(s => ({ n: s[0], v: s[1] }));
    return groups;
}

function fetchFilters(tid) {
    tid = String(tid);
    if (filterCache[tid]) return filterCache[tid];
    let filters = null;
    try {
        const html = httpGet(HOST + '/index.php/vod/type/id/' + tid + '.html');
        filters = parseScreen(html, tid);
    } catch (e) { filters = null; }
    if (!filters || !Object.keys(filters).length) filters = fallbackFilters(tid);
    filterCache[tid] = filters;
    return filters;
}

function buildFilters(tid) {
    tid = String(tid);
    const groups = [];
    const dyn = fetchFilters(tid);
    let subs = (dyn['sub'] || []).filter(v => String(v.v || '').trim());
    if (!subs.length) subs = (SUBS[tid] || []).map(s => ({ n: s[1], v: s[0] }));
    if (subs.length) groups.push({ key: 'sub', name: '子分类', value: [{ n: '全部', v: '' }].concat(subs) });
    const names = { 'class': '类型', 'area': '地区', 'year': '年份', 'lang': '语言', 'by': '排序' };
    ['class', 'area', 'year', 'lang', 'by'].forEach(dim => {
        let vals = dyn[dim];
        if (!vals || !vals.length) {
            if (dim === 'by') vals = SORTS.map(s => ({ n: s[0], v: s[1] }));
            else return;
        }
        groups.push({ key: dim, name: names[dim], value: vals });
    });
    return groups;
}

// ==================== TVBox 接口 ====================
function init(ext) {
    if (ext) {
        const h = (typeof ext === 'string' ? ext : '').trim();
        if (h) HOST = h.replace(/\/+$/, '');
    }
}

function home(filter) {
    const classes = CATEGORIES.map(c => ({ type_id: c[0], type_name: c[1] }));
    const result = { 'class': classes };
    if (filter) {
        const filters = {};
        CATEGORIES.forEach(c => { filters[c[0]] = buildFilters(c[0]); });
        result.filters = filters;
    }
    return JSON.stringify(result);
}

function homeVod() {
    const html = httpGet(HOST + '/index.php');
    return JSON.stringify({ list: parseList(html, false) });
}

function category(tid, pg, filter, extend) {
    let page = parseInt(pg, 10) || 1;
    if (page < 1) page = 1;
    let ext = extend || {};
    if (typeof extend === 'string') { try { ext = JSON.parse(extend); } catch (e) { ext = {}; } }

    let base = normTid(tid);
    const sub = String(ext.sub || '').trim();
    if (/^\d+$/.test(sub)) base = sub;
    const cls = String(ext['class'] || '').trim();
    const area = String(ext.area || '').trim();
    const year = String(ext.year || '').trim();
    const lang = String(ext.lang || '').trim();
    const by = String(ext.by || '').trim();

    const hasFilter = !!(cls || area || year || lang || by);
    let seg;
    if (hasFilter) {
        const parts = [];
        if (cls) parts.push('class/' + cls);
        if (area) parts.push('area/' + area);
        parts.push('id/' + base);
        if (year) parts.push('year/' + year);
        if (lang) parts.push('lang/' + lang);
        if (by) parts.push('by/' + by);
        seg = '/index.php/vod/show/' + parts.join('/');
    } else {
        seg = '/index.php/vod/type/id/' + base;
    }
    let url = HOST + seg + '.html';
    if (page > 1) url = HOST + seg + '/page/' + page + '.html';

    const html = httpGet(url);
    const vods = parseList(html, true);
    let pagecount = parsePagecount(html, page);
    if (!vods.length && page > 1) pagecount = page;
    const limit = vods.length || 24;
    return JSON.stringify({ list: vods, page: page, pagecount: pagecount, limit: limit, total: pagecount ? pagecount * limit : vods.length });
}

// ==================== 详情 ====================
function metaRow(html, label) {
    const m = new RegExp('<span class="text-muted">' + label + '：</span>([\\s\\S]*?)</p>').exec(html);
    if (!m) return '';
    const re = /<a[^>]*>([^<]+)<\/a>/g;
    const vals = [];
    let am;
    while ((am = re.exec(m[1])) !== null) {
        const v = stripTags(am[1]);
        if (v && vals.indexOf(v) < 0) vals.push(v);
    }
    return vals.length ? vals.join(',') : stripTags(m[1]);
}

function parsePlayLines(html, vid) {
    const froms = [], urls = [];
    if (!html) return [froms, urls];
    let start = html.indexOf('myui-player');
    if (start < 0) start = 0;
    let end = html.indexOf('猜你喜欢', start);
    if (end < 0) end = html.indexOf('myui-foot', start);
    if (end < 0) end = html.length;
    const body = html.substring(start, end);

    const segs = body.split('myui-panel__head');
    for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        const mt = /<h3 class="title">([\s\S]*?)<\/h3>/.exec(seg);
        const mu = /<ul class="myui-content__list[^"]*"[^>]*>([\s\S]*?)<\/ul>/.exec(seg);
        if (!mt || !mu) continue;
        let fname = stripTags(mt[1]);
        const epRe = /href="\/index\.php\/vod\/play\/id\/\d+\/sid\/(\d+)\/nid\/(\d+)\.html"[^>]*>([\s\S]*?)<\/a>/g;
        const fmt = [];
        let em;
        while ((em = epRe.exec(mu[1])) !== null) {
            let label = stripTags(em[3]) || ('第' + em[2] + '集');
            label = label.split('#').join('＃').split('$').join('＄');
            fmt.push(label + '$' + vid + '-' + em[1] + '-' + em[2]);
        }
        if (!fmt.length) continue;
        if (!fname) fname = '线路' + (froms.length + 1);
        froms.push(fname);
        urls.push(fmt.join('#'));
    }
    return [froms, urls];
}

function detail(ids) {
    let vid = String(Array.isArray(ids) ? ids[0] : ids).trim();
    const dm = /\/vod\/detail\/id\/(\d+)/.exec(vid);
    if (dm) vid = dm[1];
    vid = vid.replace(/\D/g, '');
    if (!vid) return JSON.stringify({ list: [] });

    const html = httpGet(HOST + '/index.php/vod/detail/id/' + vid + '.html');
    if (!html) {
        return JSON.stringify({ list: [{ vod_id: vid, vod_name: vid, vod_pic: '', vod_play_from: '默认', vod_play_url: '' }] });
    }

    let name = '';
    let mt = /<h1 class="title">([\s\S]*?)<\/h1>/.exec(html);
    if (mt) name = stripTags(mt[1]);
    if (!name) {
        mt = /<title>([\s\S]*?)(?:-|_|\|)/.exec(html);
        if (mt) name = stripTags(mt[1]);
    }
    if (!name) name = vid;

    let pic = '';
    const mp = /class="myui-vodlist__thumb picture"[^>]*>([\s\S]*?)<\/a>/.exec(html);
    if (mp) { const pm = /data-original="([^"]+)"/.exec(mp[1]); if (pm) pic = pm[1]; }
    if (!pic) { const pm = /data-original="([^"]+\.(?:jpg|jpeg|png|webp|gif))"/i.exec(html); if (pm) pic = pm[1]; }

    let score = '';
    const ms = /<span class="branch">([\s\S]*?)<\/span>/.exec(html);
    if (ms) score = stripTags(ms[1]);

    let area = '', vclass = '', year = '';
    const pRe = /<p class="data">([\s\S]*?)<\/p>/g;
    let pm2;
    while ((pm2 = pRe.exec(html)) !== null) {
        const row = pm2[1];
        if (row.indexOf('地区：') >= 0 && !area) {
            const am = /地区：<\/span>(?:\s*<a[^>]*>([^<]+)<\/a>|\s*([^<\n]*?)(?:<|$))/.exec(row);
            if (am) area = stripTags(am[1] || am[2] || '');
        }
        if (row.indexOf('分类：') >= 0 && !vclass) {
            let cm = /分类：<\/span>\s*<a[^>]*>([^<]+)<\/a>/.exec(row);
            if (!cm) cm = /分类：<\/span>\s*([^<\n]*?)(?:<|$)/.exec(row);
            if (cm) vclass = stripTags(cm[1]);
        }
        if (row.indexOf('年份：') >= 0 && !year) {
            const ym = /年份：<\/span>\s*(?:<a[^>]*>)?\s*(\d{4})/.exec(row);
            if (ym) year = ym[1];
        }
    }

    let remark = '';
    let mr = /<span class="text-muted">更新：<\/span>([\s\S]*?)<\/p>/.exec(html);
    if (mr) remark = stripTags(mr[1]);
    if (!remark) { mr = /class="text-red">([\s\S]*?)<\/span>/.exec(html); if (mr) remark = stripTags(mr[1]); }

    const actor = metaRow(html, '主演');
    const director = metaRow(html, '导演');

    let lang = '';
    const ml = /<span class="text-muted">语言：<\/span>([\s\S]*?)<\/p>/.exec(html);
    if (ml) lang = stripTags(ml[1]);

    let desc = '';
    let md = /<span class="data"[^>]*>\s*<p>([\s\S]*?)<\/p>/.exec(html);
    if (md) desc = stripTags(md[1]);
    if (!desc) { md = /<span class="sketch[^"]*">([\s\S]*?)<\/span>/.exec(html); if (md) desc = stripTags(md[1]); }
    if (!desc) { md = /<span class="text-muted">简介：<\/span>([\s\S]*?)(?:<a|$)/.exec(html); if (md) desc = stripTags(md[1]); }
    if (!desc) desc = name;
    if (desc.indexOf(INTRO_PREFIX) !== 0) desc = INTRO_PREFIX + desc;

    const [froms, urls] = parsePlayLines(html, vid);

    return JSON.stringify({
        list: [{
            vod_id: vid, vod_name: name, vod_pic: fixUrl(pic),
            vod_year: year, vod_area: area, type_name: vclass, vod_lang: lang,
            vod_remarks: remark || score, vod_actor: actor, vod_director: director,
            vod_content: desc, vod_score: score,
            vod_play_from: froms.length ? froms.join('$$$') : '默认',
            vod_play_url: urls.length ? urls.join('$$$') : ''
        }]
    });
}

// ==================== 播放 ====================
function extractPlayer(html) {
    const i = html.indexOf('player_data');
    if (i < 0) return null;
    const j = html.indexOf('{', i);
    if (j < 0) return null;
    let depth = 0, end = -1;
    for (let k = j; k < html.length; k++) {
        const c = html.charAt(k);
        if (c === '{') depth++;
        else if (c === '}') { depth--; if (depth === 0) { end = k; break; } }
    }
    if (end < 0) return null;
    try { return JSON.parse(html.substring(j, end + 1)); } catch (e) { return null; }
}

function unescapeUrl(s) {
    if (!s) return '';
    s = s.split('\\/').join('/');
    try { return JSON.parse('"' + s.split('"').join('\\"') + '"'); } catch (e) {}
    try { s = s.replace(/\\u([0-9a-fA-F]{4})/g, (m, g) => String.fromCharCode(parseInt(g, 16))); } catch (e) {}
    return s;
}

function b64decode(str) {
    const C = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const clean = String(str).replace(/[^A-Za-z0-9+/=]/g, '');
    const bytes = [];
    for (let i = 0; i < clean.length; i += 4) {
        const n = (C.indexOf(clean[i]) << 18) | (C.indexOf(clean[i + 1]) << 12) |
            ((clean[i + 2] === '=' ? 0 : C.indexOf(clean[i + 2])) << 6) | (clean[i + 3] === '=' ? 0 : C.indexOf(clean[i + 3]));
        bytes.push((n >> 16) & 255);
        if (clean[i + 2] !== '=') bytes.push((n >> 8) & 255);
        if (clean[i + 3] !== '=') bytes.push(n & 255);
    }
    let out = '';
    let i = 0;
    while (i < bytes.length) {
        const b = bytes[i];
        if (b < 0x80) { out += String.fromCharCode(b); i += 1; }
        else if (b < 0xE0) { out += String.fromCharCode(((b & 31) << 6) | (bytes[i + 1] & 63)); i += 2; }
        else if (b < 0xF0) { out += String.fromCharCode(((b & 15) << 12) | ((bytes[i + 1] & 63) << 6) | (bytes[i + 2] & 63)); i += 3; }
        else { i += 4; }
    }
    return out;
}

function resolveJx(token, endpoint) {
    if (!token || !endpoint) return '';
    const target = (endpoint.indexOf('http') === 0 ? endpoint : JX_HOST + endpoint) + encodeURIComponent(token);
    try {
        const r = req(target, { headers: headers(HOST + '/'), timeout: 20000 });
        const t = (r && r.content) || '';
        if (t.indexOf('Warning') >= 0 || t.indexOf('Undefined') >= 0) return '';
        const cands = [];
        let m = /var\s+playUrl\s*=\s*['"]([^'"]+)['"]/.exec(t);
        if (m) cands.push(m[1]);
        const re = /['"]([^'"]+\.m3u8[^'"]*)['"]/g;
        while ((m = re.exec(t)) !== null) cands.push(m[1]);
        for (let i = 0; i < cands.length; i++) {
            const c = unescapeUrl(cands[i]).trim();
            if (c.indexOf('http') === 0) return c;
        }
    } catch (e) {}
    return '';
}

function playHeader() {
    return { 'User-Agent': UA, 'Referer': HOST + '/', 'X-Requested-With': 'XMLHttpRequest', 'Accept': '*/*' };
}

function playResult(url) {
    url = String(url || '').split('\\/').join('/').trim();
    if (url.indexOf('http') === 0 && isVideoFormat(url)) {
        return JSON.stringify({ parse: 0, jx: 0, url: url, header: playHeader() });
    }
    return JSON.stringify({ parse: 1, jx: 1, url: url, header: playHeader() });
}

function play(flag, id, vipFlags) {
    const pid = String(id || '').trim();
    if (pid.indexOf('http') === 0) return playResult(pid);
    const parts = pid.split('-');
    if (parts.length < 3) return JSON.stringify({ parse: 1, url: pid, header: playHeader() });
    const playUrl = HOST + '/index.php/vod/play/id/' + parts[0] + '/sid/' + parts[1] + '/nid/' + parts[2] + '.html';

    const html = httpGet(playUrl);
    if (!html) return JSON.stringify({ parse: 1, url: playUrl, header: playHeader() });
    const cfg = extractPlayer(html);
    if (!cfg) return JSON.stringify({ parse: 1, url: playUrl, header: playHeader() });

    const enc = String(cfg.encrypt || 0);
    let raw = String(cfg.url || '');
    if (enc === '1') {
        try { raw = decodeURIComponent(raw); } catch (e) {}
    } else if (enc === '2') {
        try { raw = decodeURIComponent(b64decode(raw)); } catch (e) {}
    }
    raw = unescapeUrl(raw).trim();

    if (raw.indexOf('http') === 0 && isVideoFormat(raw)) return playResult(raw);

    const fromSrc = String(cfg.from || '').trim();
    if (raw) {
        const endpoints = [];
        if (fromSrc && JX_PARSE[fromSrc]) endpoints.push(JX_PARSE[fromSrc]);
        for (let i = 0; i < JX_FALLBACK.length; i++) {
            if (endpoints.indexOf(JX_FALLBACK[i]) < 0) endpoints.push(JX_FALLBACK[i]);
        }
        for (let i = 0; i < endpoints.length; i++) {
            const m3 = resolveJx(raw, endpoints[i]);
            if (m3) return playResult(m3);
        }
    }
    return JSON.stringify({ parse: 1, url: playUrl, header: playHeader() });
}

// ==================== 搜索 ====================
function search(key, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    const wd = String(key || '').trim();
    if (!wd) return JSON.stringify({ list: [], page: 1, pagecount: 0, limit: 0, total: 0 });

    // 站点搜索限流 10 秒, QuickJS 无法 sleep, 间隔不足直接返回空避免触发封禁
    const now = Date.now();
    if (now - lastSearch < 11000) return JSON.stringify({ list: [], page: page, pagecount: 0, limit: 0, total: 0 });
    lastSearch = now;

    const wdQ = encodeURIComponent(wd);
    let url = HOST + '/index.php/vod/search/wd/' + wdQ + '.html';
    if (page > 1) url = HOST + '/index.php/vod/search/wd/' + wdQ + '/page/' + page + '.html';

    const html = httpGet(url);
    const vods = [];
    if (html) {
        const i = html.indexOf('id="searchList"');
        const seg = i >= 0 ? html.substring(i) : '';
        const seen = {};
        const liRe = /<li class="clearfix">([\s\S]*?)<\/li>/g;
        let block;
        while ((block = liRe.exec(seg)) !== null) {
            const b = block[1];
            let m = /href="(\/index\.php\/vod\/detail\/id\/(\d+)\.html)"[^>]*title="([^"]*)"[^>]*data-original="([^"]*)"/.exec(b);
            if (!m) m = /<h4 class="title">\s*<a[^>]*href="(\/index\.php\/vod\/detail\/id\/(\d+)\.html)"[^>]*>([\s\S]*?)<\/a>/.exec(b);
            if (!m) continue;
            const vid = m[2];
            if (!vid || seen[vid]) continue;
            const name = stripTags(m[3]);
            if (!name) continue;
            let pic = '';
            const pmm = /data-original="([^"]+)"/.exec(b);
            if (pmm) pic = pmm[1];
            let remark = '';
            const rm = /class="tag"[^>]*>([\s\S]*?)<\/span>/.exec(b);
            if (rm) remark = stripTags(rm[1]);
            seen[vid] = 1;
            vods.push({ vod_id: vid, vod_name: name, vod_pic: fixUrl(pic), vod_remarks: remark });
        }
    }
    return JSON.stringify({ list: vods, page: page, pagecount: vods.length ? 1 : 0, limit: vods.length || 10, total: vods.length });
}

export default { init, home, homeVod, category, detail, search, play };
