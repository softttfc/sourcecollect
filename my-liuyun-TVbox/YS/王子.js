// 王子TV TVBox  爬虫（www.wangzitv.com/index.html 琉芸JS版）
// 发布页 www.wangzitv.com/index.html 动态解析真实站域名（hostJs 逻辑），兜底 www.202799.xyz
// 播放页 player_aaaa JSON encrypt:0=明文/1=URL编码/2=base64，解出直链 parse:0，失败回退嗅探
const PUBLISH_URL = "https://www.wangzitv.com/index.html";
const FALLBACK_HOST = "https://www.202799.xyz";
const UA = "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
const TIMEOUT = 15000;
const LINE_PRIORITY = ["BF线路", "SL线路"];

// 线路优先级: BF线路、SL线路排到最前, 其余保持页面原顺序; 线路名与集数成对移动
function prioritizeLines(names, urls) {
    const items = [];
    for (let i = 0; i < names.length; i++) items.push({ name: names[i], url: urls[i] || "" });
    const first = [];
    for (let p = 0; p < LINE_PRIORITY.length; p++) {
        for (let i = 0; i < items.length; i++) {
            if (items[i] && String(items[i].name).replace(/\s+/g, "") === LINE_PRIORITY[p] && first.indexOf(items[i]) < 0) first.push(items[i]);
        }
    }
    const rest = [];
    for (let i = 0; i < items.length; i++) if (first.indexOf(items[i]) < 0) rest.push(items[i]);
    return first.concat(rest);
}

let HOST = FALLBACK_HOST;

const classes = [
    { type_id: "dianying", type_name: "电影" },
    { type_id: "dianshiju", type_name: "电视剧" },
    { type_id: "zongyi", type_name: "综艺" },
    { type_id: "dongman", type_name: "动漫" },
    { type_id: "duanju", type_name: "短剧" }
];

const filters = {
    "dianying": [{ "key": "剧情", "name": "剧情", "value": [{ "n": "全部", "v": "" }, { "n": "喜剧", "v": "喜剧" }, { "n": "爱情", "v": "爱情" }, { "n": "恐怖", "v": "恐怖" }, { "n": "动作", "v": "动作" }, { "n": "科幻", "v": "科幻" }, { "n": "剧情", "v": "剧情" }, { "n": "战争", "v": "战争" }, { "n": "警匪", "v": "警匪" }, { "n": "犯罪", "v": "犯罪" }, { "n": "动画", "v": "动画" }, { "n": "奇幻", "v": "奇幻" }, { "n": "武侠", "v": "武侠" }, { "n": "冒险", "v": "冒险" }, { "n": "枪战", "v": "枪战" }, { "n": "恐怖", "v": "恐怖" }, { "n": "悬疑", "v": "悬疑" }, { "n": "惊悚", "v": "惊悚" }, { "n": "经典", "v": "经典" }, { "n": "青春", "v": "青春" }, { "n": "文艺", "v": "文艺" }, { "n": "微电影", "v": "微电影" }, { "n": "古装", "v": "古装" }, { "n": "历史", "v": "历史" }, { "n": "运动", "v": "运动" }, { "n": "农村", "v": "农村" }, { "n": "儿童", "v": "儿童" }, { "n": "网络电影", "v": "网络电影" }] }, { "key": "地区", "name": "地区", "value": [{ "n": "全部", "v": "" }, { "n": "大陆", "v": "大陆" }, { "n": "香港", "v": "香港" }, { "n": "台湾", "v": "台湾" }, { "n": "美国", "v": "美国" }, { "n": "法国", "v": "法国" }, { "n": "英国", "v": "英国" }, { "n": "日本", "v": "日本" }, { "n": "韩国", "v": "韩国" }, { "n": "德国", "v": "德国" }, { "n": "泰国", "v": "泰国" }, { "n": "印度", "v": "印度" }, { "n": "意大利", "v": "意大利" }, { "n": "西班牙", "v": "西班牙" }, { "n": "加拿大", "v": "加拿大" }, { "n": "其他", "v": "其他" }] }, { "key": "语言", "name": "语言", "value": [{ "n": "全部", "v": "" }, { "n": "国语", "v": "国语" }, { "n": "英语", "v": "英语" }, { "n": "粤语", "v": "粤语" }, { "n": "闽南语", "v": "闽南语" }, { "n": "韩语", "v": "韩语" }, { "n": "日语", "v": "日语" }, { "n": "法语", "v": "法语" }, { "n": "德语", "v": "德语" }, { "n": "其它", "v": "其它" }] }, { "key": "年份", "name": "年份", "value": [{ "n": "全部", "v": "" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "2020" }, { "n": "2019", "v": "2019" }, { "n": "2018", "v": "2018" }, { "n": "2017", "v": "2017" }, { "n": "2016", "v": "2016" }, { "n": "2015", "v": "2015" }, { "n": "2014", "v": "2014" }, { "n": "2013", "v": "2013" }, { "n": "2012", "v": "2012" }, { "n": "2011", "v": "2011" }, { "n": "2010", "v": "2010" }] }, { "key": "字母", "name": "字母", "value": [{ "n": "字母", "v": "" }, { "n": "A", "v": "A" }, { "n": "B", "v": "B" }, { "n": "C", "v": "C" }, { "n": "D", "v": "D" }, { "n": "E", "v": "E" }, { "n": "F", "v": "F" }, { "n": "G", "v": "G" }, { "n": "H", "v": "H" }, { "n": "I", "v": "I" }, { "n": "J", "v": "J" }, { "n": "K", "v": "K" }, { "n": "L", "v": "L" }, { "n": "M", "v": "M" }, { "n": "N", "v": "N" }, { "n": "O", "v": "O" }, { "n": "P", "v": "P" }, { "n": "Q", "v": "Q" }, { "n": "R", "v": "R" }, { "n": "S", "v": "S" }, { "n": "T", "v": "T" }, { "n": "U", "v": "U" }, { "n": "V", "v": "V" }, { "n": "W", "v": "W" }, { "n": "X", "v": "X" }, { "n": "Y", "v": "Y" }, { "n": "Z", "v": "Z" }, { "n": "0-9", "v": "0" }] }, { "key": "排序", "name": "排序", "value": [{ "n": "时间排序", "v": "time" }, { "n": "人气排序", "v": "hits" }, { "n": "评分排序", "v": "score" }] }],
    "dianshiju": [{ "key": "剧情", "name": "剧情", "value": [{ "n": "全部", "v": "" }, { "n": "古装", "v": "古装" }, { "n": "战争", "v": "战争" }, { "n": "青春偶像", "v": "青春偶像" }, { "n": "喜剧", "v": "喜剧" }, { "n": "家庭", "v": "家庭" }, { "n": "犯罪", "v": "犯罪" }, { "n": "动作", "v": "动作" }, { "n": "奇幻", "v": "奇幻" }, { "n": "剧情", "v": "剧情" }, { "n": "历史", "v": "历史" }, { "n": "经典", "v": "经典" }, { "n": "乡村", "v": "乡村" }, { "n": "情景", "v": "情景" }, { "n": "商战", "v": "商战" }, { "n": "网剧", "v": "网剧" }, { "n": "其他", "v": "其他" }] }, { "key": "地区", "name": "地区", "value": [{ "n": "全部", "v": "" }, { "n": "内地", "v": "内地" }, { "n": "韩国", "v": "韩国" }, { "n": "香港", "v": "香港" }, { "n": "台湾", "v": "台湾" }, { "n": "日本", "v": "日本" }, { "n": "美国", "v": "美国" }, { "n": "泰国", "v": "泰国" }, { "n": "英国", "v": "英国" }, { "n": "新加坡", "v": "新加坡" }, { "n": "其他", "v": "其他" }] }, { "key": "语言", "name": "语言", "value": [{ "n": "全部", "v": "" }, { "n": "国语", "v": "国语" }, { "n": "英语", "v": "英语" }, { "n": "粤语", "v": "粤语" }, { "n": "闽南语", "v": "闽南语" }, { "n": "韩语", "v": "韩语" }, { "n": "日语", "v": "日语" }, { "n": "其它", "v": "其它" }] }, { "key": "年份", "name": "年份", "value": [{ "n": "全部", "v": "" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "2020" }, { "n": "2019", "v": "2019" }, { "n": "2018", "v": "2018" }, { "n": "2017", "v": "2017" }, { "n": "2016", "v": "2016" }, { "n": "2015", "v": "2015" }, { "n": "2014", "v": "2014" }, { "n": "2013", "v": "2013" }, { "n": "2012", "v": "2012" }, { "n": "2011", "v": "2011" }, { "n": "2010", "v": "2010" }] }, { "key": "字母", "name": "字母", "value": [{ "n": "字母", "v": "" }, { "n": "A", "v": "A" }, { "n": "B", "v": "B" }, { "n": "C", "v": "C" }, { "n": "D", "v": "D" }, { "n": "E", "v": "E" }, { "n": "F", "v": "F" }, { "n": "G", "v": "G" }, { "n": "H", "v": "H" }, { "n": "I", "v": "I" }, { "n": "J", "v": "J" }, { "n": "K", "v": "K" }, { "n": "L", "v": "L" }, { "n": "M", "v": "M" }, { "n": "N", "v": "N" }, { "n": "O", "v": "O" }, { "n": "P", "v": "P" }, { "n": "Q", "v": "Q" }, { "n": "R", "v": "R" }, { "n": "S", "v": "S" }, { "n": "T", "v": "T" }, { "n": "U", "v": "U" }, { "n": "V", "v": "V" }, { "n": "W", "v": "W" }, { "n": "X", "v": "X" }, { "n": "Y", "v": "Y" }, { "n": "Z", "v": "Z" }, { "n": "0-9", "v": "0" }] }, { "key": "排序", "name": "排序", "value": [{ "n": "时间排序", "v": "time" }, { "n": "人气排序", "v": "hits" }, { "n": "评分排序", "v": "score" }] }],
    "zongyi": [{ "key": "剧情", "name": "剧情", "value": [{ "n": "全部", "v": "" }, { "n": "选秀", "v": "选秀" }, { "n": "情感", "v": "情感" }, { "n": "访谈", "v": "访谈" }, { "n": "播报", "v": "播报" }, { "n": "旅游", "v": "旅游" }, { "n": "音乐", "v": "音乐" }, { "n": "美食", "v": "美食" }, { "n": "纪实", "v": "纪实" }, { "n": "曲艺", "v": "曲艺" }, { "n": "生活", "v": "生活" }, { "n": "游戏互动", "v": "游戏互动" }, { "n": "财经", "v": "财经" }, { "n": "求职", "v": "求职" }] }, { "key": "地区", "name": "地区", "value": [{ "n": "全部", "v": "" }, { "n": "内地", "v": "内地" }, { "n": "港台", "v": "港台" }, { "n": "日韩", "v": "日韩" }, { "n": "欧美", "v": "欧美" }] }, { "key": "语言", "name": "语言", "value": [{ "n": "全部", "v": "" }, { "n": "国语", "v": "国语" }, { "n": "英语", "v": "英语" }, { "n": "粤语", "v": "粤语" }, { "n": "闽南语", "v": "闽南语" }, { "n": "韩语", "v": "韩语" }, { "n": "日语", "v": "日语" }, { "n": "其它", "v": "其它" }] }, { "key": "年份", "name": "年份", "value": [{ "n": "全部", "v": "" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "2020" }, { "n": "2019", "v": "2019" }, { "n": "2018", "v": "2018" }, { "n": "2017", "v": "2017" }, { "n": "2016", "v": "2016" }, { "n": "2015", "v": "2015" }, { "n": "2014", "v": "2014" }, { "n": "2013", "v": "2013" }, { "n": "2012", "v": "2012" }, { "n": "2011", "v": "2011" }, { "n": "2010", "v": "2010" }] }, { "key": "字母", "name": "字母", "value": [{ "n": "字母", "v": "" }, { "n": "A", "v": "A" }, { "n": "B", "v": "B" }, { "n": "C", "v": "C" }, { "n": "D", "v": "D" }, { "n": "E", "v": "E" }, { "n": "F", "v": "F" }, { "n": "G", "v": "G" }, { "n": "H", "v": "H" }, { "n": "I", "v": "I" }, { "n": "J", "v": "J" }, { "n": "K", "v": "K" }, { "n": "L", "v": "L" }, { "n": "M", "v": "M" }, { "n": "N", "v": "N" }, { "n": "O", "v": "O" }, { "n": "P", "v": "P" }, { "n": "Q", "v": "Q" }, { "n": "R", "v": "R" }, { "n": "S", "v": "S" }, { "n": "T", "v": "T" }, { "n": "U", "v": "U" }, { "n": "V", "v": "V" }, { "n": "W", "v": "W" }, { "n": "X", "v": "X" }, { "n": "Y", "v": "Y" }, { "n": "Z", "v": "Z" }, { "n": "0-9", "v": "0" }] }, { "key": "排序", "name": "排序", "value": [{ "n": "时间排序", "v": "time" }, { "n": "人气排序", "v": "hits" }, { "n": "评分排序", "v": "score" }] }],
    "dongman": [{ "key": "剧情", "name": "剧情", "value": [{ "n": "全部", "v": "" }, { "n": "情感", "v": "情感" }, { "n": "科幻", "v": "科幻" }, { "n": "热血", "v": "热血" }, { "n": "推理", "v": "推理" }, { "n": "搞笑", "v": "搞笑" }, { "n": "冒险", "v": "冒险" }, { "n": "萝莉", "v": "萝莉" }, { "n": "校园", "v": "校园" }, { "n": "动作", "v": "动作" }, { "n": "机战", "v": "机战" }, { "n": "运动", "v": "运动" }, { "n": "战争", "v": "战争" }, { "n": "少年", "v": "少年" }, { "n": "少女", "v": "少女" }, { "n": "社会", "v": "社会" }, { "n": "原创", "v": "原创" }, { "n": "亲子", "v": "亲子" }, { "n": "益智", "v": "益智" }, { "n": "励志", "v": "励志" }, { "n": "其他", "v": "其他" }] }, { "key": "地区", "name": "地区", "value": [{ "n": "全部", "v": "" }, { "n": "国产", "v": "国产" }, { "n": "日本", "v": "日本" }, { "n": "欧美", "v": "欧美" }, { "n": "其他", "v": "其他" }] }, { "key": "语言", "name": "语言", "value": [{ "n": "全部", "v": "" }, { "n": "国语", "v": "国语" }, { "n": "英语", "v": "英语" }, { "n": "粤语", "v": "粤语" }, { "n": "闽南语", "v": "闽南语" }, { "n": "韩语", "v": "韩语" }, { "n": "日语", "v": "日语" }, { "n": "其它", "v": "其它" }] }, { "key": "年份", "name": "年份", "value": [{ "n": "全部", "v": "" }, { "n": "2024", "v": "2024" }, { "n": "2023", "v": "2023" }, { "n": "2022", "v": "2022" }, { "n": "2021", "v": "2021" }, { "n": "2020", "v": "2020" }, { "n": "2019", "v": "2019" }, { "n": "2018", "v": "2018" }, { "n": "2017", "v": "2017" }, { "n": "2016", "v": "2016" }, { "n": "2015", "v": "2015" }, { "n": "2014", "v": "2014" }, { "n": "2013", "v": "2013" }, { "n": "2012", "v": "2012" }, { "n": "2011", "v": "2011" }, { "n": "2010", "v": "2010" }] }, { "key": "字母", "name": "字母", "value": [{ "n": "字母", "v": "" }, { "n": "A", "v": "A" }, { "n": "B", "v": "B" }, { "n": "C", "v": "C" }, { "n": "D", "v": "D" }, { "n": "E", "v": "E" }, { "n": "F", "v": "F" }, { "n": "G", "v": "G" }, { "n": "H", "v": "H" }, { "n": "I", "v": "I" }, { "n": "J", "v": "J" }, { "n": "K", "v": "K" }, { "n": "L", "v": "L" }, { "n": "M", "v": "M" }, { "n": "N", "v": "N" }, { "n": "O", "v": "O" }, { "n": "P", "v": "P" }, { "n": "Q", "v": "Q" }, { "n": "R", "v": "R" }, { "n": "S", "v": "S" }, { "n": "T", "v": "T" }, { "n": "U", "v": "U" }, { "n": "V", "v": "V" }, { "n": "W", "v": "W" }, { "n": "X", "v": "X" }, { "n": "Y", "v": "Y" }, { "n": "Z", "v": "Z" }, { "n": "0-9", "v": "0" }] }, { "key": "排序", "name": "排序", "value": [{ "n": "时间排序", "v": "time" }, { "n": "人气排序", "v": "hits" }, { "n": "评分排序", "v": "score" }] }],
    "duanju": [{ "key": "字母", "name": "字母", "value": [{ "n": "字母", "v": "" }, { "n": "A", "v": "A" }, { "n": "B", "v": "B" }, { "n": "C", "v": "C" }, { "n": "D", "v": "D" }, { "n": "E", "v": "E" }, { "n": "F", "v": "F" }, { "n": "G", "v": "G" }, { "n": "H", "v": "H" }, { "n": "I", "v": "I" }, { "n": "J", "v": "J" }, { "n": "K", "v": "K" }, { "n": "L", "v": "L" }, { "n": "M", "v": "M" }, { "n": "N", "v": "N" }, { "n": "O", "v": "O" }, { "n": "P", "v": "P" }, { "n": "Q", "v": "Q" }, { "n": "R", "v": "R" }, { "n": "S", "v": "S" }, { "n": "T", "v": "T" }, { "n": "U", "v": "U" }, { "n": "V", "v": "V" }, { "n": "W", "v": "W" }, { "n": "X", "v": "X" }, { "n": "Y", "v": "Y" }, { "n": "Z", "v": "Z" }, { "n": "0-9", "v": "0" }] }, { "key": "排序", "name": "排序", "value": [{ "n": "时间排序", "v": "time" }, { "n": "人气排序", "v": "hits" }, { "n": "评分排序", "v": "score" }] }]
  };

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64decode(s) {
    let out = [], i = 0, buf = 0, bits = 0;
    s = String(s).replace(/[^A-Za-z0-9+/=]/g, "");
    while (i < s.length) {
        const c = s.charAt(i++);
        if (c === "=") break;
        buf = (buf << 6) | B64.indexOf(c); bits += 6;
        if (bits >= 8) { bits -= 8; out.push((buf >> bits) & 0xFF); }
    }
    let str = "";
    for (const b of out) str += String.fromCharCode(b);
    try { return decodeURIComponent(str.split("").map(function (c) { return "%" + ("0" + c.charCodeAt(0).toString(16)).slice(-2); }).join("")); } catch (e) { return str; }
}

function stripTags(s) {
    return (s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

async function fetchText(url) {
    // 站点偶有风控空响应，重试一次
    for (let i = 0; i < 2; i++) {
        try {
            const res = await req(url, { headers: { "User-Agent": UA }, timeout: TIMEOUT });
            const content = res ? (res.content || "") : "";
            if (content) return content;
        } catch (e) {
            console.error("请求失败[" + url + "]:", e.message);
        }
    }
    return "";
}

// 分类/首页卡片：module-poster-item（详情链接 /detail/数字.html）
function parseCards(html) {
    const out = [];
    const re = /<a\s+href="(\/detail\/\d+\.html)"[^>]*?title="([^"]*)"[^>]*class="module-poster-item module-item"([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const block = m[3];
        let pic = "";
        const pm = /data-original="([^"]+)"/.exec(block);
        if (pm) pic = pm[1];
        let remarks = "";
        const nm = /<div class="module-item-note">([^<]*)<\/div>/.exec(block);
        if (nm) remarks = nm[1].trim();
        out.push({ vod_id: m[1], vod_name: m[2], vod_pic: pic, vod_remarks: remarks });
    }
    return out;
}

function maxPage(html, pattern) {
    const re = new RegExp(pattern, "g");
    let m, max = 0;
    while ((m = re.exec(html)) !== null) {
        const n = parseInt(m[1]);
        if (n > max) max = n;
    }
    return max;
}

// 发布页解析真实域名（对应原规则 hostJs：.panel-box 第一个链接）
async function resolveHost() {
    try {
        const html = await fetchText(PUBLISH_URL);
        const i = html.indexOf("panel-box");
        if (i >= 0) {
            const m = /<a href="(https?:\/\/[^"]+)"[^>]*class="btn-down"/.exec(html.substring(i))
                || /<a href="(https?:\/\/[^"]+)"/.exec(html.substring(i, i + 2000));
            if (m && m[1]) {
                HOST = m[1].replace(/\/+$/, "");
                console.log("王子TV真实域名: " + HOST);
                return;
            }
        }
    } catch (e) {
        console.error("发布页解析失败:", e.message);
    }
    console.log("王子TV使用兜底域名: " + HOST);
}

async function init(ext) {
    await resolveHost();
    console.log("初始化爬虫: 王子TV");
}

async function home(filter) {
    let list = [];
    try {
        const html = await fetchText(HOST + "/");
        list = parseCards(html).slice(0, 60);
    } catch (e) {
        console.error("首页失败:", e.message);
    }
    return JSON.stringify({ class: classes, filters: filters, list: list });
}

async function category(tid, pg, filter, extend) {
    pg = parseInt(pg || 1) || 1;
    const fl = extend || {};
    const area = fl["地区"] || "";
    const sort = fl["排序"] || "time";
    const plot = fl["剧情"] || "";
    const lang = fl["语言"] || "";
    const letter = fl["字母"] || "";
    const year = fl["年份"] || "";
    const url = HOST + "/vodshow/" + encodeURIComponent(tid) + "-" + encodeURIComponent(area)
        + "-" + encodeURIComponent(sort) + "-" + encodeURIComponent(plot) + "-" + encodeURIComponent(lang)
        + "-" + encodeURIComponent(letter) + "---" + pg + "---" + encodeURIComponent(year) + ".html";
    try {
        const html = await fetchText(url);
        const list = parseCards(html);
        let pagecount = maxPage(html, "/vodshow/[^\"]*?---(\\d+)---");
        if (pagecount < pg) pagecount = pg;
        return JSON.stringify({ list: list, page: pg, pagecount: pagecount, limit: 40, total: 0 });
    } catch (e) {
        console.error("分类失败:", e.message);
        return JSON.stringify({ list: [], page: pg, pagecount: 1, limit: 40, total: 0 });
    }
}

async function detail(id) {
    try {
        const vid = String(id);
        const html = await fetchText(vid.indexOf("http") === 0 ? vid : HOST + vid);
        if (!html) return JSON.stringify({ list: [] });

        let name = "";
        let m = /<div class="module-info-heading"><h1>([^<]*)<\/h1>/.exec(html) || /<h1[^>]*>([^<]*)<\/h1>/.exec(html);
        if (m) name = m[1].trim();
        let pic = "";
        m = /<div class="module-info-poster">[\s\S]*?data-original="([^"]+)"/.exec(html);
        if (m) pic = m[1];
        const tags = [];
        const tre = /<div class="module-info-tag-link"><a[^>]*>([^<]*)<\/a>/g;
        let tm;
        while ((tm = tre.exec(html)) !== null) tags.push(tm[1].trim());
        let year = "", area = "", typeName = "";
        for (let i = 0; i < tags.length; i++) {
            if (!year && /^\d{4}$/.test(tags[i])) { year = tags[i]; continue; }
            if (!area) { area = tags[i]; continue; }
            typeName = typeName ? typeName + "/" + tags[i] : tags[i];
        }
        const pickItem = function (label) {
            const mm = new RegExp('<span class="module-info-item-title">' + label + '</span><div class="module-info-item-content">([\\s\\S]*?)</div>').exec(html);
            return mm ? stripTags(mm[1]).replace(/(\s*\/\s*)+$/, "") : "";
        };
        const actor = pickItem("主演：");
        const director = pickItem("导演：");
        let remarks = pickItem("更新：") || pickItem("状态：") || pickItem("备注：");
        let content = "";
        m = /<div class="module-info-introduction-content"><p>([\s\S]*?)<\/p>/.exec(html);
        if (m) content = stripTags(m[1]);

        const firstListIdx = html.indexOf('module-list sort-list tab-list');
        const headHtml = firstListIdx > 0 ? html.substring(0, firstListIdx) : html;
        const tabNames = [];
        const tbre = /<div class="module-tab-item tab-item"[^>]*><span>([^<]*)<\/span>/g;
        while ((tm = tbre.exec(headHtml)) !== null) tabNames.push(tm[1].trim());

        const urlList = [];
        const segs = html.split('<div class="module-list sort-list tab-list his-tab-list"');
        for (let i = 1; i < segs.length; i++) {
            const eps = [];
            const ere = /<a\s+class="module-play-list-link"\s+href="(\/play\/[^"]+)"[^>]*>\s*<span>([^<]*)<\/span>/g;
            let em;
            while ((em = ere.exec(segs[i])) !== null) eps.push(em[2].trim() + "$" + em[1]);
            urlList.push(eps.join("#"));
        }
        while (tabNames.length < urlList.length) tabNames.push("线路" + (tabNames.length + 1));
        const lineCount = Math.min(tabNames.length, urlList.length);
        const ordered = prioritizeLines(tabNames.slice(0, lineCount), urlList.slice(0, lineCount));

        return JSON.stringify({
            list: [{
                vod_id: vid,
                vod_name: name,
                vod_pic: pic,
                type_name: typeName,
                vod_year: year,
                vod_area: area,
                vod_lang: "",
                vod_actor: actor,
                vod_director: director,
                vod_remarks: remarks,
                vod_content: DESC_PREFIX + content,
                vod_play_from: ordered.map(function (x) { return x.name; }).join("$$$"),
                vod_play_url: ordered.map(function (x) { return x.url; }).join("$$$")
            }]
        });
    } catch (e) {
        console.error("详情失败:", e.message);
        return JSON.stringify({ list: [] });
    }
}

async function search(wd, quick, page) {
    page = parseInt(page || 1) || 1;
    const keyword = String(wd || "").trim();
    if (!keyword) return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 40, total: 0 });
    try {
        const html = await fetchText(HOST + "/vodsearch/" + encodeURIComponent(keyword) + "----------" + page + "---.html");
        // 系统安全验证（验证码）优雅降级为空
        if (!html || html.indexOf("系统安全验证") >= 0) {
            return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 40, total: 0 });
        }
        const out = [];
        const re = /<a\s+href="(\/detail\/\d+\.html)"\s+class="module-card-item-poster">([\s\S]*?)<\/a>/g;
        let m;
        while ((m = re.exec(html)) !== null) {
            const block = m[2];
            let name = "";
            let nm = /<img[^>]+alt="([^"]+)"/.exec(block);
            if (nm) name = nm[1];
            let pic = "";
            nm = /data-original="([^"]+)"/.exec(block);
            if (nm) pic = nm[1];
            let remarks = "";
            nm = /<div class="module-item-note">([^<]*)<\/div>/.exec(block);
            if (nm) remarks = nm[1].trim();
            out.push({ vod_id: m[1], vod_name: name, vod_pic: pic, vod_remarks: remarks });
        }
        return JSON.stringify({ list: out, page: page, pagecount: page, limit: 40, total: out.length });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 40, total: 0 });
    }
}

const MEDIA_RE = /\.(m3u8|mp4|flv|avi|mov|rmvb|ts|mkv)([?#&]|$)/i;

function encodeNonAscii(url) {
    try {
        return String(url).replace(/[^\x00-\x7F]/g, function (ch) { return encodeURIComponent(ch); });
    } catch (e) { return url; }
}

async function play(flag, id, vipFlags) {
    try {
        const pid = String(id || "");
        const playPageUrl = pid.indexOf("http") === 0 ? pid : HOST + pid;
        const html = await fetchText(playPageUrl);
        const idx = html.indexOf("player_aaaa=");
        if (idx >= 0) {
            const seg = html.substring(idx, idx + 4000);
            const em = /"encrypt":\s*(\d+)/.exec(seg);
            const um = /"url":\s*"([^"]*)"/.exec(seg);
            if (um && um[1]) {
                let realUrl = um[1].replace(/\\\//g, "/");
                const enc = em ? parseInt(em[1]) : 0;
                if (enc === 1) realUrl = decodeURIComponent(realUrl);
                else if (enc === 2) realUrl = b64decode(realUrl);
                if (MEDIA_RE.test(realUrl)) {
                    return JSON.stringify({ parse: 0, playUrl: "", url: encodeNonAscii(realUrl), header: { "User-Agent": UA } });
                }
                return JSON.stringify({ parse: 1, playUrl: "", url: realUrl, header: { "User-Agent": UA } });
            }
        }
        return JSON.stringify({ parse: 1, playUrl: "", url: playPageUrl, header: { "User-Agent": UA } });
    } catch (e) {
        console.error("播放失败:", e.message);
        return JSON.stringify({ parse: 0, playUrl: "", url: "" });
    }
}

export default { init, home, category, detail, search, play };
