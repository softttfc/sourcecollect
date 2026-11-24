import cheerio from 'assets://js/lib/cheerio.min.js';

const HOST = 'https://www.ixcyy.tv';
const UA = 'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

function headers() {
    return { 'User-Agent': UA, 'Referer': HOST + '/' };
}

async function get(url) {
    const r = await req(url, { method: 'GET', headers: headers(), timeout: 15000 });
    return r && r.content ? r.content : '';
}

function absUrl(url) {
    url = url || '';
    if (!url || url.startsWith('http')) return url;
    if (url.startsWith('//')) return 'https:' + url;
    return HOST + (url.startsWith('/') ? url : '/' + url);
}

function parseList(html, search) {
    const $ = cheerio.load(html);
    const list = [];
    $('div.public-list-box').each(function () {
        const box = $(this);
        const link = box.find('a.public-list-exp').first();
        const id = link.attr('href') || '';
        if (!id) return;
        let name = search ? box.find('div.thumb-txt').text().trim() : link.attr('title') || '';
        if (!name) name = link.attr('title') || box.find('a.time-title').text().trim();
        if (!name) return;
        list.push({
            vod_id: id,
            vod_name: name,
            vod_pic: absUrl(box.find('img.gen-movie-img').attr('data-src') || ''),
            vod_remarks: box.find('span.public-list-prb').text().trim()
        });
    });
    return list;
}

async function init(ext) {}

async function home(filter) {
    const ids = ['1', '2', '3', '4', '5'];
    const names = ['电影', '电视剧', '综艺', '动漫', '短剧'];
    return JSON.stringify({
        class: ids.map((id, i) => ({ type_id: id, type_name: names[i] })),
        filters: {}
    });
}

async function homeVod() {
    try {
        const $ = cheerio.load(await get(HOST));
        const list = [];
        $('div.slide-time-list div.slide-time-bj').each(function () {
            const item = $(this);
            const id = item.find('a').first().attr('href') || '';
            const name = item.find('h3.slide-info-title').text().trim();
            if (!id || !name) return;
            const style = item.find('div.slide-time-img3').attr('style') || '';
            const match = style.match(/url\(['"]?([^'")]+)['"]?\)/);
            const remarks = item.find('span.slide-info-remarks');
            list.push({
                vod_id: id,
                vod_name: name,
                vod_pic: match ? absUrl(match[1]) : '',
                vod_remarks: remarks.length > 1 ? remarks.eq(1).text().trim() : ''
            });
        });
        return JSON.stringify({ list });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function category(tid, pg, filter, extend = {}) {
    try {
        const html = await get(HOST + '/vs/' + tid + '--------' + pg + '---.html');
        return JSON.stringify({ list: parseList(html, false), page: Number(pg) || 1 });
    } catch (e) {
        return JSON.stringify({ list: [], page: Number(pg) || 1 });
    }
}

async function detail(id) {
    try {
        const url = absUrl(Array.isArray(id) ? id[0] : id);
        const $ = cheerio.load(await get(url));
        const remarks = $('span.slide-info-remarks');
        let director = [];
        let actor = [];
        let type = [];
        $('div.slide-info').each(function () {
            const row = $(this);
            const title = row.find('strong').text().trim();
            let target = null;
            if (title.startsWith('导演')) target = director;
            else if (title.startsWith('演员') || title.startsWith('主演')) target = actor;
            else if (title.startsWith('类型')) target = type;
            if (!target) return;
            row.find('a').each(function () {
                const text = $(this).text().trim();
                if (text) target.push(text);
            });
        });
        const from = [];
        const urls = [];
        const tabs = $('div.anthology-tab a');
        const groups = $('ul.anthology-list-play');
        tabs.each(function (i) {
            const name = $(this).text().trim().replace(/\d+$/, '').trim();
            if (!name || i >= groups.length) return;
            const episodes = [];
            groups.eq(i).find('li a.this-link').each(function () {
                const title = $(this).text().trim();
                const href = $(this).attr('href') || '';
                if (title && href) episodes.push(title + '$' + href);
            });
            from.push(name);
            urls.push(episodes.join('#'));
        });
        return JSON.stringify({ list: [{
            vod_id: url,
            vod_name: $('h3.slide-info-title').text().trim(),
            vod_pic: absUrl($('div.detail-pic img').attr('data-src') || ''),
            vod_remarks: remarks.length ? remarks.eq(0).text().trim() : '',
            vod_year: remarks.length >= 3 ? remarks.eq(1).text().trim() : '',
            vod_area: remarks.length >= 3 ? remarks.eq(2).text().trim() : '',
            vod_content: $('div#height_limit').text().trim(),
            vod_director: director.join(','),
            vod_actor: actor.join(','),
            type_name: type.join(','),
            vod_play_from: from.join('$$$'),
            vod_play_url: urls.join('$$$')
        }] });
    } catch (e) {
        return JSON.stringify({ list: [] });
    }
}

async function play(flag, id, flags) {
    try {
        const html = (await get(absUrl(id))).replace(/\\\//g, '/');
        const match = html.match(/"url"\s*:\s*"([^"]+\.m3u8[^"]*)"/);
        if (!match) return JSON.stringify({ parse: 0, url: '' });
        return JSON.stringify({ parse: 0, url: match[1] });
    } catch (e) {
        return JSON.stringify({ parse: 0, url: '' });
    }
}

async function search(wd, quick, pg = 1) {
    if (!wd) return JSON.stringify({ list: [] });
    try {
        const html = await get(HOST + '/s' + encodeURIComponent(wd) + '.html');
        return JSON.stringify({ list: parseList(html, true), page: Number(pg) || 1 });
    } catch (e) {
        return JSON.stringify({ list: [], page: Number(pg) || 1 });
    }
}

export default { init, home, homeVod, category, detail, play, search };
