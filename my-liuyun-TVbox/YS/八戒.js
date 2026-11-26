
// APP JSON API：动态域名 + 访客令牌 + 多线路/虚拟剧集播放

const DOMAIN_CONFIG = 'http://osstexll.oss-rg-china-mainland.aliyuncs.com/domainPath.json';
const PLAY_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 13_2_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/13.0.3 Mobile/15E148 Safari/604.1';
const TIMEOUT = 20000;

let HOST = '';
let USER_ID = '';
const HEADERS = {
    'User-Agent': 'okhttp/4.12.0',
    'client': 'app',
    'deviceType': 'Android',
    'deviceId': '2d590b9842d064a1',
    'token': ''
};

function text(value) {
    return value === null || value === undefined ? '' : String(value);
}

function getJson(url) {
    try {
        const res = req(url, {
            method: 'GET',
            headers: HEADERS,
            timeout: TIMEOUT
        });
        return JSON.parse((res && res.content) || '{}');
    } catch (e) {
        return {};
    }
}

function postJson(path, data) {
    try {
        const headers = Object.assign({}, HEADERS, {
            'Content-Type': 'application/json;charset=UTF-8'
        });
        const res = req(HOST + path, {
            method: 'POST',
            headers: headers,
            data: data,
            postType: 'json',
            timeout: TIMEOUT
        });
        return JSON.parse((res && res.content) || '{}');
    } catch (e) {
        return {};
    }
}

function init(ext) {
    HOST = '';
    USER_ID = '';
    HEADERS.token = '';
    ext = text(ext).trim();

    if (ext.indexOf('http') === 0) {
        if (/\.json(?:\?|$)/i.test(ext)) {
            const config = getJson(ext);
            HOST = config.url && config.url.length ? text(config.url[0]) : '';
        } else {
            HOST = ext.replace(/\/$/, '');
        }
    } else {
        const config = getJson(DOMAIN_CONFIG);
        HOST = config.url && config.url.length ? text(config.url[0]) : '';
    }
    HOST = HOST.replace(/\/$/, '');
    if (!HOST) return;

    const res = getJson(HOST + '/api/v1/app/user/visitorInfo');
    if (res.data) {
        USER_ID = text(res.data.id);
        HEADERS.token = text(res.data.token);
    }
}

function home(filter) {
    const classes = [];
    const res = postJson('/api/v1/app/screen/screenType', {});
    const data = Array.isArray(res.data) ? res.data : [];
    for (const item of data) {
        classes.push({
            type_id: text(item.id),
            type_name: text(item.name)
        });
    }
    return JSON.stringify({ 'class': classes, list: [], filters: {} });
}

function homeVod() {
    const list = [];
    const recommend = postJson('/api/v1/app/recommend/recommendList', {});
    const groups = Array.isArray(recommend.data) ? recommend.data : [];

    for (const group of groups) {
        const res = postJson('/api/v1/app/recommend/recommendSubList', {
            condition: parseInt(text(group.id), 10),
            pageNum: 1,
            pageSize: 6
        });
        const records = res.data && Array.isArray(res.data.records) ? res.data.records : [];
        for (const item of records) {
            list.push({
                vod_id: text(item.id),
                vod_name: text(item.name),
                vod_pic: text(item.cover),
                vod_remarks: ''
            });
        }
    }
    return JSON.stringify({ list: list });
}

function category(tid, pg, filter, extend) {
    const page = parseInt(pg, 10) || 1;
    const res = postJson('/api/v1/app/screen/screenMovie', {
        condition: {
            classify: '',
            region: '',
            sreecnTypeEnum: 'NEWEST',
            typeId: text(tid),
            year: ''
        },
        pageNum: page,
        pageSize: 40
    });
    const records = res.data && Array.isArray(res.data.records) ? res.data.records : [];
    const list = records.map(item => ({
        vod_id: text(item.id),
        vod_name: text(item.name),
        vod_pic: text(item.cover),
        vod_remarks: text(item.area),
        vod_year: text(item.year)
    }));
    return JSON.stringify({
        list: list,
        page: page,
        pagecount: 9999,
        limit: 40,
        total: 99999
    });
}

function detail(ids) {
    const vodId = text(Array.isArray(ids) ? ids[0] : ids);
    const playUrls = [];
    const playFrom = [];

    const detailRes = postJson('/api/v1/app/play/movieDetails', {
        id: parseInt(vodId, 10),
        source: 0,
        typeId: 'M17',
        userId: USER_ID
    });
    const detailData = detailRes.data || {};
    const playerId = text(detailData.playerId);
    const episodeList = Array.isArray(detailData.episodeList) ? detailData.episodeList : [];
    const episodes = [];

    for (const item of episodeList) {
        episodes.push(
            text(item.episode) + '$' + vodId + '@' + playerId + '@' + text(item.id) + '@episode'
        );
    }
    playUrls.push(episodes.join('#'));

    const players = Array.isArray(detailData.moviePlayerList) ? detailData.moviePlayerList : [];
    for (const item of players) {
        if (text(item.id) === playerId) {
            playFrom.push(text(item.moviePlayerName));
        }
    }

    for (const item of players) {
        const id = text(item.id);
        const total = item.episodeTotal === null || item.episodeTotal === undefined
            ? -1 : parseInt(item.episodeTotal, 10);
        if (id === playerId || total === -1) continue;

        const virtualEpisodes = [];
        for (let i = 1; i <= total; i++) {
            virtualEpisodes.push(
                '第' + i + '集$' + i + '@' + id + '@' + vodId + '@virtual'
            );
        }
        playUrls.push(virtualEpisodes.join('#'));

        const name = text(item.moviePlayerName);
        if (playFrom.indexOf(name) < 0) playFrom.push(name);
    }

    const descRes = postJson('/api/v1/app/play/movieDesc', {
        id: parseInt(vodId, 10),
        typeId: 'M17'
    });
    const desc = descRes.data || {};
    const vod = {
        vod_id: text(desc.id),
        vod_name: text(desc.name),
        vod_pic: text(desc.cover),
        vod_content:'【琉🔹芸❤广告勿信👉剧情】📢'+ text(desc.introduce),
        vod_remarks: '',
        vod_year: text(desc.year),
        vod_area: text(desc.area),
        vod_class: text(desc.classify),
        vod_director: text(desc.director),
        vod_play_from: playFrom.join('$$$'),
        vod_play_url: playUrls.join('$$$')
    };
    return JSON.stringify({ list: [vod] });
}

function play(flag, id, vipFlags) {
    try {
        const parts = text(id).split('@');
        if (parts.length < 4) return JSON.stringify({ parse: 0, url: '' });

        let body;
        if (parts[3] === 'virtual') {
            body = {
                episodeIndex: text(parseInt(parts[0], 10) - 1),
                id: parseInt(parts[2], 10),
                playerId: parts[1],
                source: 0,
                typeId: 'M16',
                userId: USER_ID
            };
        } else {
            body = {
                episodeId: parts[2],
                id: parseInt(parts[0], 10),
                playerId: parts[1],
                source: 0,
                typeId: 'M16',
                userId: USER_ID
            };
        }

        const detailRes = postJson('/api/v1/app/play/movieDetails', body);
        const data = detailRes.data || {};
        const analysis = getJson(
            HOST + '/api/v1/app/play/analysisMovieUrl?playerUrl=' +
            encodeURIComponent(text(data.url)) + '&playerId=' + text(data.playerId)
        );
        return JSON.stringify({
            parse: 0,
            playUrl: '',
            url: text(analysis.data),
            header: { 'User-Agent': PLAY_UA }
        });
    } catch (e) {
        return JSON.stringify({ parse: 0, playUrl: '', url: '' });
    }
}

function search(wd, quick, pg) {
    const page = parseInt(pg, 10) || 1;
    const res = postJson('/api/v1/app/search/searchMovie', {
        condition: { value: text(wd) },
        pageNum: page,
        pageSize: 40
    });
    const records = res.data && Array.isArray(res.data.records) ? res.data.records : [];
    const list = records.map(item => ({
        vod_id: text(item.id),
        vod_name: text(item.name),
        vod_pic: text(item.cover),
        vod_content: text(item.desc),
        vod_remarks: text(item.area),
        vod_year: text(item.year),
        vod_area: text(item.area)
    }));
    return JSON.stringify({
        list: list,
        page: page,
        pagecount: 9999,
        limit: 40,
        total: 99999
    });
}

export default { init, home, homeVod, category, detail, play, search };
