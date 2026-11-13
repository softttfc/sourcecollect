// 蚂蚁影视 TVBox  爬虫 琉芸JS版 
// 来源：jak0099/dr 蚂蚁影视.js（苹果CMS 首图2模板），站点 https://www.mayiyingshi.tv
// 播放链：播放页 player_data.url（mayi_前缀密文）→ iframe https://zj.sp-flv.com:8443?url= → 提取 video_url 直链
const HOST = 'https://www.mayiyingshi.tv';
const UA = 'Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36';

function fetchText(url) {
  for (let i = 0; i < 2; i++) {
    try {
      const r = req(url, { headers: { 'User-Agent': UA, 'Referer': HOST + '/' }, timeout: 15000 });
      if (r && r.content && r.content.length > 100) return r.content;
    } catch (e) {}
  }
  return '';
}

function abs(u) {
  if (!u) return '';
  if (u.startsWith('http')) return u;
  if (u.startsWith('//')) return 'https:' + u;
  return HOST + u;
}

function encodeNonAscii(s) {
  return s.replace(/[^\x00-\x7F]/g, ch => encodeURIComponent(ch));
}

// 首图2模板卡片解析：stui-vodlist__thumb 块
function parseCards(html) {
  const list = [];
  const re = /<a\s+class="stui-vodlist__thumb[^"]*"\s+href="(\/voddetail\/\d+\.html)"[^>]*title="([^"]*)"[^>]*data-original="([^"]*)"[\s\S]*?<span class="pic-text[^"]*">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    list.push({
      vod_id: m[1],
      vod_name: m[2],
      vod_pic: abs(m[3]),
      vod_remarks: m[4].trim(),
    });
  }
  return list;
}

// 首图2搜索卡片解析（结构略不同，thumb+detail）
function parseSearchCards(html) {
  const list = [];
  const re = /<a\s+class="v-thumb\s+stui-vodlist__thumb[^"]*"\s+href="(\/voddetail\/\d+\.html)"[^>]*title="([^"]*)"[^>]*data-original="([^"]*)"[\s\S]*?<span class="pic-text[^"]*">([^<]*)<\/span>/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    list.push({
      vod_id: m[1],
      vod_name: m[2],
      vod_pic: abs(m[3]),
      vod_remarks: m[4].trim(),
    });
  }
  return list;
}

function init(ext) {}

function home(filter) {
  const html = fetchText(HOST + '/');
  const classes = [
    { type_id: '2', type_name: '连续剧' },
    { type_id: '1', type_name: '电影' },
    { type_id: '3', type_name: '综艺' },
    { type_id: '4', type_name: '动漫' },
  ];
  const filters = {
    '1': [
      { key: 'class', name: '按分类', value: [
        { n: '全部', v: '' }, { n: '喜剧', v: '喜剧' }, { n: '爱情', v: '爱情' }, { n: '恐怖', v: '恐怖' },
        { n: '动作', v: '动作' }, { n: '科幻', v: '科幻' }, { n: '剧情', v: '剧情' }, { n: '战争', v: '战争' },
      ]},
      { key: 'area', name: '按地区', value: [
        { n: '全部', v: '' }, { n: '大陆', v: '大陆' }, { n: '香港', v: '香港' }, { n: '台湾', v: '台湾' },
        { n: '美国', v: '美国' }, { n: '法国', v: '法国' }, { n: '英国', v: '英国' }, { n: '日本', v: '日本' },
        { n: '韩国', v: '韩国' }, { n: '德国', v: '德国' }, { n: '泰国', v: '泰国' }, { n: '印度', v: '印度' },
        { n: '意大利', v: '意大利' }, { n: '西班牙', v: '西班牙' }, { n: '加拿大', v: '加拿大' },
      ]},
      { key: 'by', name: '排序', value: [
        { n: '按时间', v: 'time' }, { n: '按人气', v: 'hits' }, { n: '按评分', v: 'score' },
      ]},
      { key: 'year', name: '按年份', value: [
        { n: '全部', v: '' }, { n: '2026', v: '2026' }, { n: '2025', v: '2025' }, { n: '2024', v: '2024' },
        { n: '2023', v: '2023' }, { n: '2022', v: '2022' }, { n: '2021', v: '2021' }, { n: '2020', v: '2020' },
      ]},
    ],
    '2': [
      { key: 'class', name: '按分类', value: [
        { n: '全部', v: '' }, { n: '国产剧', v: '国产剧' }, { n: '港台剧', v: '港台剧' }, { n: '日韩剧', v: '日韩剧' },
        { n: '欧美剧', v: '欧美剧' }, { n: '泰国剧', v: '泰国剧' }, { n: '海外剧', v: '海外剧' },
      ]},
      { key: 'area', name: '按地区', value: [
        { n: '全部', v: '' }, { n: '大陆', v: '大陆' }, { n: '香港', v: '香港' }, { n: '台湾', v: '台湾' },
        { n: '美国', v: '美国' }, { n: '日本', v: '日本' }, { n: '韩国', v: '韩国' }, { n: '泰国', v: '泰国' },
      ]},
      { key: 'by', name: '排序', value: [
        { n: '按时间', v: 'time' }, { n: '按人气', v: 'hits' }, { n: '按评分', v: 'score' },
      ]},
      { key: 'year', name: '按年份', value: [
        { n: '全部', v: '' }, { n: '2026', v: '2026' }, { n: '2025', v: '2025' }, { n: '2024', v: '2024' },
        { n: '2023', v: '2023' }, { n: '2022', v: '2022' }, { n: '2021', v: '2021' }, { n: '2020', v: '2020' },
      ]},
    ],
    '3': [
      { key: 'class', name: '按分类', value: [
        { n: '全部', v: '' }, { n: '大陆综艺', v: '大陆综艺' }, { n: '港台综艺', v: '港台综艺' },
        { n: '日韩综艺', v: '日韩综艺' }, { n: '欧美综艺', v: '欧美综艺' },
      ]},
      { key: 'area', name: '按地区', value: [
        { n: '全部', v: '' }, { n: '大陆', v: '大陆' }, { n: '香港', v: '香港' }, { n: '台湾', v: '台湾' },
        { n: '美国', v: '美国' }, { n: '日本', v: '日本' }, { n: '韩国', v: '韩国' },
      ]},
      { key: 'by', name: '排序', value: [
        { n: '按时间', v: 'time' }, { n: '按人气', v: 'hits' }, { n: '按评分', v: 'score' },
      ]},
      { key: 'year', name: '按年份', value: [
        { n: '全部', v: '' }, { n: '2026', v: '2026' }, { n: '2025', v: '2025' }, { n: '2024', v: '2024' },
        { n: '2023', v: '2023' }, { n: '2022', v: '2022' }, { n: '2021', v: '2021' }, { n: '2020', v: '2020' },
      ]},
    ],
    '4': [
      { key: 'class', name: '按分类', value: [
        { n: '全部', v: '' }, { n: '国产动漫', v: '国产动漫' }, { n: '日韩动漫', v: '日韩动漫' }, { n: '欧美动漫', v: '欧美动漫' },
      ]},
      { key: 'area', name: '按地区', value: [
        { n: '全部', v: '' }, { n: '大陆', v: '大陆' }, { n: '日本', v: '日本' }, { n: '美国', v: '美国' }, { n: '韩国', v: '韩国' },
      ]},
      { key: 'by', name: '排序', value: [
        { n: '按时间', v: 'time' }, { n: '按人气', v: 'hits' }, { n: '按评分', v: 'score' },
      ]},
      { key: 'year', name: '按年份', value: [
        { n: '全部', v: '' }, { n: '2026', v: '2026' }, { n: '2025', v: '2025' }, { n: '2024', v: '2024' },
        { n: '2023', v: '2023' }, { n: '2022', v: '2022' }, { n: '2021', v: '2021' }, { n: '2020', v: '2020' },
      ]},
    ],
  };
  // 首页推荐：从首页第一屏卡片提取
  let list = parseCards(html);
  // 首页卡片不足时从分类页补充
  if (list.length < 12) {
    const catHtml = fetchText(HOST + '/vodtype/1-1.html');
    list = list.concat(parseCards(catHtml));
    list = list.slice(0, 24);
  }
  return JSON.stringify({ class: classes, filters, list });
}

function category(tid, pg, filter, extend) {
  pg = parseInt(pg) || 1;
  const ext = extend || {};
  const cls = ext['class'] || '';
  const area = ext['area'] || '';
  const by = ext['by'] || 'time';
  const year = ext['year'] || '';
  // 首图2模板URL规则：
  // 无筛选：/vodtype/{tid}-{pg}.html（支持分页）
  // 有筛选：/vodshow/{tid}-{area}--{cls}--------.html（无分页，始终返回第1页）
  let url, pagecount = 1;
  if (!area && !cls && !year) {
    url = HOST + '/vodtype/' + tid + '-' + pg + '.html';
    const html = fetchText(url);
    const list = parseCards(html);
    // 解析分页：stui-page 中 尾页链接
    const pm = html.match(/vodtype\/\d+-(\d+)\.html">尾页/);
    if (pm) pagecount = parseInt(pm[1]) || pg;
    else {
      const m2 = html.match(/num">(\d+)\/(\d+)</);
      if (m2) pagecount = parseInt(m2[2]) || pg;
    }
    return JSON.stringify({ list, page: pg, pagecount, limit: 20, total: pagecount * 20 });
  } else {
    const segs = [tid, area, '', cls, '', '', '', '', '', '', '', year];
    url = HOST + '/vodshow/' + segs.join('-') + '.html';
    const html = fetchText(url);
    const list = parseCards(html);
    // vodshow 无分页，始终返回第1页
    const m2 = html.match(/num">(\d+)\/(\d+)</);
    if (m2) pagecount = parseInt(m2[2]) || 1;
    return JSON.stringify({ list, page: 1, pagecount, limit: 20, total: pagecount * 20 });
  }
}

function detail(tid) {
  const url = HOST + tid;
  const html = fetchText(url);
  // 片名
  const nm = html.match(/<h1 class="title">([^<]*)<\/h1>/);
  const vod_name = nm ? nm[1].trim() : '';
  // 海报
  const pm = html.match(/data-original="([^"]*)"[^>]*class="stui-vodlist__thumb/);
  const vod_pic = pm ? abs(pm[1]) : '';
  // 主演
  const am = html.match(/主演：<\/span>([\s\S]*?)<\/p>/);
  let vod_actor = '';
  if (am) {
    vod_actor = (am[1].match(/>([^<]*)<\/a>/g) || []).map(s => s.replace(/[><]/g, '').replace(/&nbsp;/g, ' ')).join(',');
  }
  // 导演
  const dm = html.match(/导演：<\/span>([\s\S]*?)<\/p>/);
  let vod_director = '';
  if (dm) {
    vod_director = (dm[1].match(/>([^<]*)<\/a>/g) || []).map(s => s.replace(/[><]/g, '').replace(/&nbsp;/g, ' ')).join(',');
  }
  // 类型/地区/年份
  const tm = html.match(/类型：<\/span>([\s\S]*?)<\/p>/);
  const vod_class = tm ? tm[1].replace(/<[^>]*>/g, '').replace(/\s+/g, '').trim() : '';
  const rm = html.match(/地区：<\/span>([^<\s]+)/);
  const vod_area = rm ? rm[1].trim() : '';
  const ym = html.match(/年份：<\/span>(\d+)/);
  const vod_year = ym ? ym[1] : '';
  // 简介
  const im = html.match(/detail-sketch">([\s\S]*?)<\/span>/);
  const vod_content = '【琉🔹芸❤广告勿信👉剧情】📢' + (im ? im[1].trim() : '');
  // 线路：play_source a[data-mid]
  const lines = [];
  const lm = html.match(/<div class="play_source clearfix">([\s\S]*?)<\/div>/);
  if (lm) {
    const lre = /<a\s+class="btn\s+title"\s+data-mid="(\d+)"[^>]*>[\s\S]*?<\/em>\s*([^<]*)<\/a>/g;
    let m2;
    while ((m2 = lre.exec(lm[1])) !== null) {
      lines.push({ mid: m2[1], name: m2[2].trim() });
    }
  }
  // 剧集：play_source_list_item[data-mid]
  const playlists = {};
  const pre = /<ul class="stui-content__playlist\s+play_source_list_item\s+clearfix"\s+data-mid="(\d+)"[\s\S]*?<\/ul>/g;
  let pm2;
  while ((pm2 = pre.exec(html)) !== null) {
    const mid = pm2[1];
    const eps = [];
    const ere = /<a\s+href="(\/vodplay\/[^"]+)">([^<]*)<\/a>/g;
    let em;
    while ((em = ere.exec(pm2[0])) !== null) {
      eps.push(encodeNonAscii(em[2].trim()) + '$' + em[1]);
    }
    playlists[mid] = eps;
  }
  const play_from = lines.map(l => l.name).join('$$$');
  const play_url = lines.map(l => (playlists[l.mid] || []).join('#')).join('$$$');
  return JSON.stringify({ list: [{
    vod_id: tid,
    vod_name,
    vod_pic,
    vod_year,
    vod_area,
    vod_class,
    vod_actor,
    vod_director,
    vod_content,
    vod_play_from: play_from,
    vod_play_url: play_url,
  }] });
}

function search(wd, quick, pg) {
  pg = parseInt(pg) || 1;
  const url = HOST + '/vodsearch/' + encodeURIComponent(wd) + '----------' + pg + '---.html';
  const html = fetchText(url);
  const list = parseSearchCards(html);
  return JSON.stringify({ list, page: pg, pagecount: 1, limit: 20, total: list.length });
}

function play(flag, id, vipFlags) {
  // id 格式：/vodplay/261607-1-1.html
  const url = HOST + id;
  const html = fetchText(url);
  const pm = html.match(/player_data\s*=\s*(\{[\s\S]*?\})\s*<\/script>/);
  if (pm) {
    try {
      const j = JSON.parse(pm[1]);
      let playUrl = j.url || '';
      // encrypt 1: URL解码；2: base64解码
      if (j.encrypt === '1') {
        playUrl = decodeURIComponent(playUrl);
      } else if (j.encrypt === '2') {
        playUrl = decodeURIComponent(base64decode(playUrl));
      }
      // mayi_ 前缀密文需走 iframe 解析
      if (playUrl.startsWith('mayi_')) {
        const iframeUrl = 'https://zj.sp-flv.com:8443?url=' + playUrl;
        const iframeHtml = fetchText(iframeUrl);
        const vm = iframeHtml.match(/video_url\s*=\s*'([^']*)'/);
        if (vm && vm[1]) {
          return JSON.stringify({ parse: 0, playUrl: '', url: vm[1], header: { 'User-Agent': UA, 'Referer': HOST + '/' } });
        }
      }
      // 已是直链
      if (playUrl.startsWith('http')) {
        return JSON.stringify({ parse: 0, playUrl: '', url: playUrl, header: { 'User-Agent': UA, 'Referer': HOST + '/' } });
      }
    } catch (e) {}
  }
  // 兜底：内置嗅探
  return JSON.stringify({ parse: 1, url: url, header: { 'User-Agent': UA, 'Referer': HOST + '/' } });
}

// 内置 base64 解码（QuickJS 无 atob）
function base64decode(str) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let out = '';
  let i = 0;
  str = str.replace(/=+$/, '');
  while (i < str.length) {
    const c1 = chars.indexOf(str.charAt(i++));
    const c2 = chars.indexOf(str.charAt(i++));
    const c3 = chars.indexOf(str.charAt(i++));
    const c4 = chars.indexOf(str.charAt(i++));
    const n = (c1 << 18) | (c2 << 12) | ((c3 & 63) << 6) | (c4 & 63);
    out += String.fromCharCode((n >> 16) & 255);
    if (c3 !== -1) out += String.fromCharCode((n >> 8) & 255);
    if (c4 !== -1) out += String.fromCharCode(n & 255);
  }
  return out;
}

export default { init, home, category, detail, search, play };
