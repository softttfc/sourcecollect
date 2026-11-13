// 追剧影视(来看剧 zjuba) - maccms HTML 解析（琉芸JS版）
// 源规则: 追剧影视.json (zjuba.vip 已迁移至 www.zjuba4.com)
// 分类url: /index.php/vod/show/by/{by}/class/{class}/id/{cateId}/page/{catePg}.html
// 播放: player_aaaa 直链解析, encrypt 非0回退 parse:1 嗅探
// 搜索: GET /index.php/vod/search/page/{pg}/wd/{wd}.html (POST有滑块验证)

const INTRO_PREFIX = '【琉🔹芸❤广告勿信👉剧情】📢';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';
const TIMEOUT = 20000;

let HOST = 'https://www.zjuba4.com';

const CLASSES = [
    { type_id: '1', type_name: '电影' },
    { type_id: '2', type_name: '电视剧' },
    { type_id: '3', type_name: '综艺' },
    { type_id: '4', type_name: '动漫' },
    { type_id: 'new', type_name: '更新' }
];

function fetchText(url) {
    try {
        const r = req(url, { headers: { 'User-Agent': UA, 'Referer': HOST + '/' }, timeout: TIMEOUT });
        return (r && r.content) || '';
    } catch (e) { return ''; }
}

function stripTags(s) {
    return String(s || '').replace(/<[^>]+>/g, '').replace(/&[a-z]+;/g, ' ').replace(/\s+/g, ' ').trim();
}

// 通用卡片解析: 详情锚点 + 附近 data-original / module-item-note, 按id去重
function parseCards(html, limit) {
    const list = [], seen = {};
    const re = /<a\s+href="\/vod\/detail\/id\/(\d+)\.html"[^>]*>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const id = m[1];
        if (seen[id]) continue;
        const seg = html.substring(m.index, m.index + 1500);
        let name = '';
        const tm = /<a\s+href="\/vod\/detail\/id\/\d+\.html"[^>]*title="([^"]*)"/.exec(m[0]);
        if (tm) name = tm[1];
        if (!name) {
            const am = /alt="([^"]+)"/.exec(seg);
            name = am ? am[1].replace(/免费在线观看|免费观看/g, '').trim() : '';
        }
        if (!name) continue;
        seen[id] = 1;
        const pm = /data-original="([^"]*)"/.exec(seg);
        const nm = /module-item-note[^>]*>([\s\S]{0,60}?)<\//.exec(seg);
        list.push({
            vod_id: id,
            vod_name: name,
            vod_pic: pm ? pm[1] : '',
            vod_remarks: nm ? stripTags(nm[1]) : ''
        });
        if (limit && list.length >= limit) break;
    }
    return list;
}

function init(ext) {
    if (ext) {
        const s = String(ext).trim();
        if (s.indexOf('http') === 0) HOST = s.replace(/\/+$/, '');
    }
}

function home(filter) {
    return JSON.stringify({ 'class': CLASSES, filters: {} });
}

function homeVod() {
    const html = fetchText(HOST + '/');
    let list = parseCards(html, 40);
    if (!list.length) {
        // 兜底: 更新页第1页
        list = parseCards(fetchText(HOST + '/vod/show/by/time/page/1.html'), 40);
    }
    return JSON.stringify({ list: list });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    let by = 'time', cls = '';
    try {
        const ex = typeof extend === 'string' && extend ? JSON.parse(extend) : (extend || {});
        if (ex.by) by = ex.by;
        if (ex['class']) cls = ex['class'];
    } catch (e) {}
    // 注意: 空的 class/id 段会破坏路由(渲染空白频道页), 需按需拼接
    let path = '/vod/show/by/' + by + '/';
    if (cls) path += 'class/' + cls + '/';
    if (String(tid) !== 'new') path += 'id/' + String(tid) + '/';
    path += 'page/' + page + '.html';
    const url = HOST + path;
    const html = fetchText(url);
    const list = parseCards(html, 0);
    // 分页: 从页面取最大页码
    let pagecount = page;
    const pm = html.match(/page\/(\d+)\.html/g);
    if (pm) {
        let mx = 0;
        for (const p of pm) {
            const n = parseInt(p.replace(/\D/g, ''), 10);
            if (n > mx) mx = n;
        }
        if (mx > pagecount) pagecount = mx;
    }
    if (list.length) pagecount = Math.max(pagecount, page + 1);
    return JSON.stringify({ list: list, page: page, pagecount: pagecount, limit: 24, total: 999999 });
}

function detail(ids) {
    try {
        const vid = String(Array.isArray(ids) ? ids[0] : ids);
        const html = fetchText(HOST + '/vod/detail/id/' + vid + '.html');
        if (!html) return JSON.stringify({ list: [] });

        const tm = /<h1[^>]*>([\s\S]{0,200}?)<\/h1>/.exec(html);
        const pm = /module-info-poster[\s\S]{0,600}?data-original="([^"]*)"/.exec(html);
        const cm = /module-info-introduction-content[^>]*>([\s\S]{0,2000}?)<\/div>/.exec(html);
        // 资料项: 导演/主演/更新/备注
        let director = '', actor = '', remarks = '', year = '', area = '';
        const metaRe = /<div class="module-info-item[^"]*">([\s\S]{0,500}?)<\/div>\s*<\/div>/g;
        let mm;
        while ((mm = metaRe.exec(html)) !== null) {
            const txt = mm[1];
            const plain = stripTags(txt);
            if (txt.indexOf('导演：') >= 0) director = plain.replace(/^导演：/, '').replace(/\s*\/\s*/g, ' ');
            else if (txt.indexOf('主演：') >= 0) actor = plain.replace(/^主演：/, '').replace(/\s*\/\s*/g, ' ');
            else if (txt.indexOf('备注：') >= 0) remarks = (remarks || plain.replace(/^.*备注：/, ''));
            else if (txt.indexOf('更新：') >= 0) {
                const ym = /(20\d{2})/.exec(plain);
                if (ym) year = ym[1];
                const rm = /备注：\s*(.+)$/.exec(plain);
                if (rm) remarks = rm[1].trim();
            }
        }

        // 线路 tab
        const tabs = [];
        const tabRe = /<div class="module-tab-item tab-item"[^>]*data-dropdown-value="([^"]*)"/g;
        let tb;
        while ((tb = tabRe.exec(html)) !== null) tabs.push(tb[1]);

        // 分 panel 剧集
        const panels = html.split('<div class="module-list sort-list tab-list his-tab-list').slice(1);
        const fromNames = [], fromUrls = [];
        for (let i = 0; i < panels.length; i++) {
            const eps = [];
            const epRe = /<a class="module-play-list-link" href="(\/vod\/play\/id\/\d+\/sid\/\d+\/nid\/\d+\.html)"[^>]*>\s*<span>([^<]*)<\/span>/g;
            let em;
            while ((em = epRe.exec(panels[i])) !== null) {
                eps.push((em[2] || '播放') + '$' + em[1]);
            }
            if (eps.length) {
                fromNames.push(tabs[i] || ('线路' + (i + 1)));
                fromUrls.push(eps.join('#'));
            }
        }
        // 兜底: 无 panel 时全页提取
        if (!fromUrls.length) {
            const eps = [];
            const epRe = /<a class="module-play-list-link" href="(\/vod\/play\/id\/\d+\/sid\/\d+\/nid\/\d+\.html)"[^>]*>\s*<span>([^<]*)<\/span>/g;
            let em;
            while ((em = epRe.exec(html)) !== null) eps.push((em[2] || '播放') + '$' + em[1]);
            if (eps.length) { fromNames.push('追剧专线'); fromUrls.push(eps.join('#')); }
        }
        if (!fromUrls.length) return JSON.stringify({ list: [] });

        let content = cm ? stripTags(cm[1]) : '';
        if (content.indexOf(INTRO_PREFIX) !== 0) content = INTRO_PREFIX + content;
        return JSON.stringify({ list: [{
            vod_id: vid,
            vod_name: tm ? stripTags(tm[1]) : '',
            vod_pic: pm ? pm[1] : '',
            vod_actor: actor,
            vod_director: director,
            vod_year: year,
            vod_area: area,
            vod_remarks: remarks,
            vod_content: content,
            vod_play_from: fromNames.join('$$$'),
            vod_play_url: fromUrls.join('$$$')
        }] });
    } catch (e) { return JSON.stringify({ list: [] }); }
}

function play(flag, id, vipFlags) {
    const path = String(id);
    const pageUrl = path.indexOf('http') === 0 ? path : HOST + path;
    const hdr = { 'User-Agent': UA, 'Referer': HOST + '/' };
    try {
        const html = fetchText(pageUrl);
        const cfg = /var player_aaaa\s*=\s*(\{[\s\S]*?\})\s*<\/script>/.exec(html);
        if (cfg) {
            const obj = JSON.parse(cfg[1]);
            const url = String(obj.url || '');
            const encrypt = parseInt(obj.encrypt, 10) || 0;
            if (url && url.indexOf('http') === 0) {
                if (encrypt === 0 && /\.(m3u8|mp4|mkv|flv|ts|m4s)(\?|$)/i.test(url)) {
                    return JSON.stringify({ parse: 0, url: url, header: hdr });
                }
                if (encrypt === 0 && url.indexOf('.m3u8') < 0 && url.indexOf('.mp4') < 0) {
                    // 非直链(第三方页面)交壳嗅探
                    return JSON.stringify({ parse: 1, url: url, header: hdr });
                }
                return JSON.stringify({ parse: 1, url: url, header: hdr });
            }
        }
    } catch (e) {}
    return JSON.stringify({ parse: 1, url: pageUrl, header: hdr });
}

function search(key, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    const url = HOST + '/index.php/vod/search/page/' + page + '/wd/' + encodeURIComponent(String(key)) + '.html';
    const html = fetchText(url);
    // 滑块/安全验证优雅降级
    if (!html || /安全验证|slide_verify|系统安全验证/.test(html)) {
        return JSON.stringify({ list: [], page: page, pagecount: page, limit: 24, total: 0 });
    }
    // module-card-item 结构
    const list = [], seen = {};
    const re = /<div class="module-card-item module-item">([\s\S]{0,1800}?)(?=<div class="module-card-item module-item">|<\/div>\s*<\/div>\s*<\/div>)/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const seg = m[1];
        const hm = /href="\/vod\/detail\/id\/(\d+)\.html"/.exec(seg);
        if (!hm || seen[hm[1]]) continue;
        seen[hm[1]] = 1;
        const am = /alt="([^"]+)"/.exec(seg);
        const pm = /data-original="([^"]*)"/.exec(seg);
        const nm = /module-item-note[^>]*>([\s\S]{0,60}?)<\//.exec(seg);
        const cm = /module-card-item-class[^>]*>([^<]*)</.exec(seg);
        list.push({
            vod_id: hm[1],
            vod_name: am ? am[1].trim() : '',
            vod_pic: pm ? pm[1] : '',
            vod_remarks: (cm ? stripTags(cm[1]) + ' ' : '') + (nm ? stripTags(nm[1]) : '')
        });
    }
    if (!list.length) {
        // 兜底通用卡片解析
        for (const v of parseCards(html, 0)) {
            if (!seen[v.vod_id]) { seen[v.vod_id] = 1; list.push(v); }
        }
    }
    return JSON.stringify({ list: list, page: page, pagecount: list.length >= 20 ? page + 1 : page, limit: 24, total: 999999 });
}

export default { init, home, homeVod, category, detail, play, search };
