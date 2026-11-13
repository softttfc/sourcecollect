// 农民影视 TVBox  爬虫（vip.wwgz.cn:5200 琉芸JS版）
// 站点 vip.wwgz.cn:5200，正则移植 drpy CSS 选择器逻辑
// 播放链路：播放页 mac_url 取地址 → api.wwgz.cn:520/player 换直链（失败回退直链/内置嗅探）
const HOST = "https://vip.wwgz.cn:5200";
const PLAYER_API = "https://api.wwgz.cn:520/player/?url=";
const UA = "Mozilla/5.0 (Linux; Android 13; SM-G991B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
const DESC_PREFIX = "【琉🔹芸❤广告勿信👉剧情】📢";
const TIMEOUT = 15000;

const classes = [
    { type_id: "1", type_name: "电影" },
    { type_id: "2", type_name: "连续剧" },
    { type_id: "3", type_name: "综艺" },
    { type_id: "4", type_name: "动漫" },
    { type_id: "26", type_name: "短剧" }
];

const filters = {"1":[{"key":"cateId","name":"类型","value":[{"n":"全部","v":"1"},{"n":"动作片","v":"5"},{"n":"喜剧片","v":"6"},{"n":"爱情片","v":"7"},{"n":"科幻片","v":"8"},{"n":"恐怖片","v":"9"},{"n":"剧情片","v":"10"},{"n":"战争片","v":"11"},{"n":"惊悚片","v":"16"},{"n":"奇幻片","v":"17"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"大陆","v":"大陆"},{"n":"香港","v":"香港"},{"n":"台湾","v":"台湾"},{"n":"美国","v":"美国"},{"n":"韩国","v":"韩国"},{"n":"日本","v":"日本"},{"n":"泰国","v":"泰国"},{"n":"新加坡","v":"新加坡"},{"n":"马来西亚","v":"马来西亚"},{"n":"印度","v":"印度"},{"n":"英国","v":"英国"},{"n":"法国","v":"法国"},{"n":"加拿大","v":"加拿大"},{"n":"西班牙","v":"西班牙"},{"n":"俄罗斯","v":"俄罗斯"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"},{"n":"2009","v":"2009"},{"n":"2008","v":"2008"},{"n":"2007","v":"2007"},{"n":"2006","v":"2006"},{"n":"2005","v":"2005"},{"n":"2004","v":"2004"},{"n":"2003","v":"2003"},{"n":"2002","v":"2002"},{"n":"2001","v":"2001"},{"n":"2000","v":"2000"},{"n":"1999","v":"1999"},{"n":"1998","v":"1998"},{"n":"1997","v":"1997"},{"n":"1996","v":"1996"},{"n":"1995","v":"1995"},{"n":"1994","v":"1994"},{"n":"1993","v":"1993"},{"n":"1992","v":"1992"},{"n":"1991","v":"1991"},{"n":"1990","v":"1990"},{"n":"1989","v":"1989"},{"n":"1988","v":"1988"},{"n":"1987","v":"1987"},{"n":"1986","v":"1986"},{"n":"1985","v":"1985"},{"n":"1984","v":"1984"},{"n":"1983","v":"1983"},{"n":"1982","v":"1982"},{"n":"1981","v":"1981"},{"n":"1980","v":"1980"},{"n":"1979","v":"1979"},{"n":"1978","v":"1978"},{"n":"1977","v":"1977"},{"n":"1976","v":"1976"},{"n":"1975","v":"1975"},{"n":"1974","v":"1974"},{"n":"1973","v":"1973"},{"n":"1972","v":"1972"},{"n":"1971","v":"1971"},{"n":"1970","v":"1970"},{"n":"1969","v":"1969"},{"n":"1968","v":"1968"},{"n":"1967","v":"1967"},{"n":"1966","v":"1966"},{"n":"1965","v":"1965"},{"n":"1964","v":"1964"},{"n":"1963","v":"1963"},{"n":"1962","v":"1962"},{"n":"1961","v":"1961"},{"n":"1960","v":"1960"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}],"2":[{"key":"cateId","name":"类型","value":[{"n":"全部","v":"2"},{"n":"国产剧","v":"12"},{"n":"港台泰","v":"13"},{"n":"日韩剧","v":"14"},{"n":"欧美剧","v":"15"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"大陆","v":"大陆"},{"n":"香港","v":"香港"},{"n":"台湾","v":"台湾"},{"n":"美国","v":"美国"},{"n":"韩国","v":"韩国"},{"n":"日本","v":"日本"},{"n":"泰国","v":"泰国"},{"n":"新加坡","v":"新加坡"},{"n":"马来西亚","v":"马来西亚"},{"n":"印度","v":"印度"},{"n":"英国","v":"英国"},{"n":"法国","v":"法国"},{"n":"加拿大","v":"加拿大"},{"n":"西班牙","v":"西班牙"},{"n":"俄罗斯","v":"俄罗斯"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"},{"n":"2009","v":"2009"},{"n":"2008","v":"2008"},{"n":"2007","v":"2007"},{"n":"2006","v":"2006"},{"n":"2005","v":"2005"},{"n":"2004","v":"2004"},{"n":"2003","v":"2003"},{"n":"2002","v":"2002"},{"n":"2001","v":"2001"},{"n":"2000","v":"2000"},{"n":"1999","v":"1999"},{"n":"1998","v":"1998"},{"n":"1997","v":"1997"},{"n":"1996","v":"1996"},{"n":"1995","v":"1995"},{"n":"1994","v":"1994"},{"n":"1993","v":"1993"},{"n":"1992","v":"1992"},{"n":"1991","v":"1991"},{"n":"1990","v":"1990"},{"n":"1989","v":"1989"},{"n":"1988","v":"1988"},{"n":"1987","v":"1987"},{"n":"1986","v":"1986"},{"n":"1985","v":"1985"},{"n":"1984","v":"1984"},{"n":"1983","v":"1983"},{"n":"1982","v":"1982"},{"n":"1981","v":"1981"},{"n":"1980","v":"1980"},{"n":"1979","v":"1979"},{"n":"1978","v":"1978"},{"n":"1977","v":"1977"},{"n":"1976","v":"1976"},{"n":"1975","v":"1975"},{"n":"1974","v":"1974"},{"n":"1973","v":"1973"},{"n":"1972","v":"1972"},{"n":"1971","v":"1971"},{"n":"1970","v":"1970"},{"n":"1969","v":"1969"},{"n":"1968","v":"1968"},{"n":"1967","v":"1967"},{"n":"1966","v":"1966"},{"n":"1965","v":"1965"},{"n":"1964","v":"1964"},{"n":"1963","v":"1963"},{"n":"1962","v":"1962"},{"n":"1961","v":"1961"},{"n":"1960","v":"1960"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}],"3":[{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"大陆","v":"大陆"},{"n":"香港","v":"香港"},{"n":"台湾","v":"台湾"},{"n":"美国","v":"美国"},{"n":"韩国","v":"韩国"},{"n":"日本","v":"日本"},{"n":"泰国","v":"泰国"},{"n":"新加坡","v":"新加坡"},{"n":"马来西亚","v":"马来西亚"},{"n":"印度","v":"印度"},{"n":"英国","v":"英国"},{"n":"法国","v":"法国"},{"n":"加拿大","v":"加拿大"},{"n":"西班牙","v":"西班牙"},{"n":"俄罗斯","v":"俄罗斯"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"},{"n":"2009","v":"2009"},{"n":"2008","v":"2008"},{"n":"2007","v":"2007"},{"n":"2006","v":"2006"},{"n":"2005","v":"2005"},{"n":"2004","v":"2004"},{"n":"2003","v":"2003"},{"n":"2002","v":"2002"},{"n":"2001","v":"2001"},{"n":"2000","v":"2000"},{"n":"1999","v":"1999"},{"n":"1998","v":"1998"},{"n":"1997","v":"1997"},{"n":"1996","v":"1996"},{"n":"1995","v":"1995"},{"n":"1994","v":"1994"},{"n":"1993","v":"1993"},{"n":"1992","v":"1992"},{"n":"1991","v":"1991"},{"n":"1990","v":"1990"},{"n":"1989","v":"1989"},{"n":"1988","v":"1988"},{"n":"1987","v":"1987"},{"n":"1986","v":"1986"},{"n":"1985","v":"1985"},{"n":"1984","v":"1984"},{"n":"1983","v":"1983"},{"n":"1982","v":"1982"},{"n":"1981","v":"1981"},{"n":"1980","v":"1980"},{"n":"1979","v":"1979"},{"n":"1978","v":"1978"},{"n":"1977","v":"1977"},{"n":"1976","v":"1976"},{"n":"1975","v":"1975"},{"n":"1974","v":"1974"},{"n":"1973","v":"1973"},{"n":"1972","v":"1972"},{"n":"1971","v":"1971"},{"n":"1970","v":"1970"},{"n":"1969","v":"1969"},{"n":"1968","v":"1968"},{"n":"1967","v":"1967"},{"n":"1966","v":"1966"},{"n":"1965","v":"1965"},{"n":"1964","v":"1964"},{"n":"1963","v":"1963"},{"n":"1962","v":"1962"},{"n":"1961","v":"1961"},{"n":"1960","v":"1960"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}],"4":[{"key":"cateId","name":"类型","value":[{"n":"全部","v":"4"},{"n":"动漫剧","v":"18"},{"n":"动漫片","v":"19"}]},{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"大陆","v":"大陆"},{"n":"香港","v":"香港"},{"n":"台湾","v":"台湾"},{"n":"美国","v":"美国"},{"n":"韩国","v":"韩国"},{"n":"日本","v":"日本"},{"n":"泰国","v":"泰国"},{"n":"新加坡","v":"新加坡"},{"n":"马来西亚","v":"马来西亚"},{"n":"印度","v":"印度"},{"n":"英国","v":"英国"},{"n":"法国","v":"法国"},{"n":"加拿大","v":"加拿大"},{"n":"西班牙","v":"西班牙"},{"n":"俄罗斯","v":"俄罗斯"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"},{"n":"2009","v":"2009"},{"n":"2008","v":"2008"},{"n":"2007","v":"2007"},{"n":"2006","v":"2006"},{"n":"2005","v":"2005"},{"n":"2004","v":"2004"},{"n":"2003","v":"2003"},{"n":"2002","v":"2002"},{"n":"2001","v":"2001"},{"n":"2000","v":"2000"},{"n":"1999","v":"1999"},{"n":"1998","v":"1998"},{"n":"1997","v":"1997"},{"n":"1996","v":"1996"},{"n":"1995","v":"1995"},{"n":"1994","v":"1994"},{"n":"1993","v":"1993"},{"n":"1992","v":"1992"},{"n":"1991","v":"1991"},{"n":"1990","v":"1990"},{"n":"1989","v":"1989"},{"n":"1988","v":"1988"},{"n":"1987","v":"1987"},{"n":"1986","v":"1986"},{"n":"1985","v":"1985"},{"n":"1984","v":"1984"},{"n":"1983","v":"1983"},{"n":"1982","v":"1982"},{"n":"1981","v":"1981"},{"n":"1980","v":"1980"},{"n":"1979","v":"1979"},{"n":"1978","v":"1978"},{"n":"1977","v":"1977"},{"n":"1976","v":"1976"},{"n":"1975","v":"1975"},{"n":"1974","v":"1974"},{"n":"1973","v":"1973"},{"n":"1972","v":"1972"},{"n":"1971","v":"1971"},{"n":"1970","v":"1970"},{"n":"1969","v":"1969"},{"n":"1968","v":"1968"},{"n":"1967","v":"1967"},{"n":"1966","v":"1966"},{"n":"1965","v":"1965"},{"n":"1964","v":"1964"},{"n":"1963","v":"1963"},{"n":"1962","v":"1962"},{"n":"1961","v":"1961"},{"n":"1960","v":"1960"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}],"26":[{"key":"area","name":"地区","value":[{"n":"全部","v":""},{"n":"大陆","v":"大陆"},{"n":"香港","v":"香港"},{"n":"台湾","v":"台湾"},{"n":"美国","v":"美国"},{"n":"韩国","v":"韩国"},{"n":"日本","v":"日本"},{"n":"泰国","v":"泰国"},{"n":"新加坡","v":"新加坡"},{"n":"马来西亚","v":"马来西亚"},{"n":"印度","v":"印度"},{"n":"英国","v":"英国"},{"n":"法国","v":"法国"},{"n":"加拿大","v":"加拿大"},{"n":"西班牙","v":"西班牙"},{"n":"俄罗斯","v":"俄罗斯"},{"n":"其它","v":"其它"}]},{"key":"year","name":"年代","value":[{"n":"全部","v":""},{"n":"2023","v":"2023"},{"n":"2022","v":"2022"},{"n":"2021","v":"2021"},{"n":"2020","v":"2020"},{"n":"2019","v":"2019"},{"n":"2018","v":"2018"},{"n":"2017","v":"2017"},{"n":"2016","v":"2016"},{"n":"2015","v":"2015"},{"n":"2014","v":"2014"},{"n":"2013","v":"2013"},{"n":"2012","v":"2012"},{"n":"2011","v":"2011"},{"n":"2010","v":"2010"},{"n":"2009","v":"2009"},{"n":"2008","v":"2008"},{"n":"2007","v":"2007"},{"n":"2006","v":"2006"},{"n":"2005","v":"2005"},{"n":"2004","v":"2004"},{"n":"2003","v":"2003"},{"n":"2002","v":"2002"},{"n":"2001","v":"2001"},{"n":"2000","v":"2000"},{"n":"1999","v":"1999"},{"n":"1998","v":"1998"},{"n":"1997","v":"1997"},{"n":"1996","v":"1996"},{"n":"1995","v":"1995"},{"n":"1994","v":"1994"},{"n":"1993","v":"1993"},{"n":"1992","v":"1992"},{"n":"1991","v":"1991"},{"n":"1990","v":"1990"},{"n":"1989","v":"1989"},{"n":"1988","v":"1988"},{"n":"1987","v":"1987"},{"n":"1986","v":"1986"},{"n":"1985","v":"1985"},{"n":"1984","v":"1984"},{"n":"1983","v":"1983"},{"n":"1982","v":"1982"},{"n":"1981","v":"1981"},{"n":"1980","v":"1980"},{"n":"1979","v":"1979"},{"n":"1978","v":"1978"},{"n":"1977","v":"1977"},{"n":"1976","v":"1976"},{"n":"1975","v":"1975"},{"n":"1974","v":"1974"},{"n":"1973","v":"1973"},{"n":"1972","v":"1972"},{"n":"1971","v":"1971"},{"n":"1970","v":"1970"},{"n":"1969","v":"1969"},{"n":"1968","v":"1968"},{"n":"1967","v":"1967"},{"n":"1966","v":"1966"},{"n":"1965","v":"1965"},{"n":"1964","v":"1964"},{"n":"1963","v":"1963"},{"n":"1962","v":"1962"},{"n":"1961","v":"1961"},{"n":"1960","v":"1960"}]},{"key":"by","name":"排序","value":[{"n":"时间","v":"time"},{"n":"人气","v":"hits"},{"n":"评分","v":"score"}]}]};

function stripTags(s) {
    return (s || "").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&")
        .replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").trim();
}

async function fetchText(url, referer) {
    try {
        const headers = { "User-Agent": UA };
        if (referer) headers["Referer"] = referer;
        const res = await req(url, { headers: headers, timeout: TIMEOUT });
        return res ? (res.content || "") : "";
    } catch (e) {
        console.error("请求失败[" + url + "]:", e.message);
        return "";
    }
}

// 通用卡片解析：首页推荐/分类列表/搜索结果均为 vod-detail 锚点结构
function parseCards(html) {
    const out = [];
    const re = /<a\s+href="(\/vod-detail-id-\d+\.html)"[^>]*?title="([^"]*)"([\s\S]*?)<\/a>/g;
    let m;
    while ((m = re.exec(html)) !== null) {
        const block = m[3];
        let pic = "";
        const pm = /<img[^>]+?(?:data-src|src)="([^"]+)"/.exec(block);
        if (pm) pic = pm[1];
        let remarks = "";
        const bm = /<span class="sBottom">([\s\S]*?)<\/span><span class="covericon/.exec(block)
            || /<span class="sBottom">([\s\S]*?)<\/span><\/span>/.exec(block)
            || /<span class="sBottom">([\s\S]*?)<\/span>/.exec(block);
        if (bm) remarks = stripTags(bm[1]);
        let name = m[2];
        if (!name) {
            const tm = /<span class="sTit">([\s\S]*?)<\/span>/.exec(block);
            if (tm) name = stripTags(tm[1]);
        }
        out.push({ vod_id: m[1], vod_name: name, vod_pic: pic, vod_remarks: remarks });
    }
    return out;
}

async function init(ext) {
    console.log("初始化爬虫: 农民影视");
}

async function home(filter) {
    let list = [];
    try {
        const html = await fetchText(HOST + "/");
        list = parseCards(html);
    } catch (e) {
        console.error("首页失败:", e.message);
    }
    return JSON.stringify({ class: classes, filters: filters, list: list });
}

async function category(tid, pg, filter, extend) {
    pg = parseInt(pg || 1) || 1;
    const fl = extend || {};
    const cateId = fl.cateId || tid;
    const by = fl.by || "time";
    const year = fl.year || "";
    const letter = fl.letter || "";
    const area = fl.area || "";
    const url = HOST + "/vod-list-id-" + encodeURIComponent(cateId)
        + "-pg-" + pg + "-order--by-" + encodeURIComponent(by)
        + "-class-0-year-" + encodeURIComponent(year)
        + "-letter-" + encodeURIComponent(letter)
        + "-area-" + encodeURIComponent(area) + "-lang-.html";
    try {
        const html = await fetchText(url);
        const list = parseCards(html);
        let pagecount = pg;
        const pm = /共(\d+)条数据[^<]*?当前:\s*\d+\/(\d+)页/.exec(html);
        if (pm) pagecount = parseInt(pm[2]);
        else if (list.length >= 30) pagecount = pg + 1;
        return JSON.stringify({ list: list, page: pg, pagecount: pagecount, limit: 30, total: 0 });
    } catch (e) {
        console.error("分类失败:", e.message);
        return JSON.stringify({ list: [], page: pg, pagecount: 1, limit: 30, total: 0 });
    }
}

function pickDesc(html, label) {
    const m = new RegExp(label + "[^<]*</span>([\\s\\S]*?)</div>").exec(html);
    return m ? stripTags(m[1]) : "";
}

async function detail(id) {
    try {
        const vid = String(id);
        const html = await fetchText(vid.indexOf("http") === 0 ? vid : HOST + vid);
        if (!html) return JSON.stringify({ list: [] });

        let name = "";
        let m = /<h1 class="title">[\s\S]*?<a[^>]*>([\s\S]*?)<\/a>/.exec(html);
        if (m) name = stripTags(m[1]);
        let typeName = "";
        m = /<h1 class="type-title">([\s\S]*?)<\/h1>/.exec(html);
        if (m) typeName = stripTags(m[1]);
        let pic = "";
        m = /<section class="page-hd">[\s\S]*?<img[^>]+src="([^"]+)"/.exec(html);
        if (m) pic = m[1];
        const actor = pickDesc(html, "主演:");
        const director = pickDesc(html, "导演:");
        const updateTime = pickDesc(html, "更新日期:");
        const year = pickDesc(html, "年代:");
        let content = "";
        m = /<article class="detail-con">[\s\S]*?<p>([\s\S]*?)<\/p>/.exec(html);
        if (m) content = stripTags(m[1]).replace(/^简\s*介[：:]?\s*/, "");

        // 线路 tabs 与各 numList 按顺序一一对应
        const tabNames = [];
        m = /<div class="hd"><ul>([\s\S]*?)<\/ul>/.exec(html);
        if (m) {
            const tre = /<a[^>]*>([^<]*)<\/a>/g;
            let tm;
            while ((tm = tre.exec(m[1])) !== null) tabNames.push(tm[1].trim() || ("线路" + (tabNames.length + 1)));
        }
        const urlList = [];
        const nre = /class="numList"[^>]*>([\s\S]*?)<\/div>/g;
        let nm;
        while ((nm = nre.exec(html)) !== null) {
            const eps = [];
            const ere = /<a\s+href="(\/vod-play-id-[^"]+)"[^>]*>([\s\S]*?)<\/a>/g;
            let em;
            while ((em = ere.exec(nm[1])) !== null) {
                eps.push(stripTags(em[2]) + "$" + em[1]);
            }
            urlList.push(eps.join("#"));
        }
        while (tabNames.length < urlList.length) tabNames.push("线路" + (tabNames.length + 1));

        return JSON.stringify({
            list: [{
                vod_id: vid,
                vod_name: name,
                vod_pic: pic,
                type_name: typeName,
                vod_year: year,
                vod_area: "",
                vod_lang: "",
                vod_actor: actor,
                vod_director: director,
                vod_remarks: updateTime,
                vod_content: DESC_PREFIX + content,
                vod_play_from: tabNames.join("$$$"),
                vod_play_url: urlList.join("$$$")
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
    if (!keyword) return JSON.stringify({ page: page, pagecount: 1, limit: 30, total: 0, list: [] });
    try {
        const html = await fetchText(HOST + "/index.php?m=vod-search&wd=" + encodeURIComponent(keyword));
        // 系统安全验证/模板缺失等异常情况优雅降级为空
        if (!html || html.indexOf("系统安全验证") >= 0 || html.indexOf("缺少文件") >= 0) {
            return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 30, total: 0 });
        }
        const list = parseCards(html);
        return JSON.stringify({ list: list, page: page, pagecount: 1, limit: 30, total: list.length });
    } catch (e) {
        console.error("搜索失败:", e.message);
        return JSON.stringify({ list: [], page: page, pagecount: 1, limit: 30, total: 0 });
    }
}

const MEDIA_RE = /\.(m3u8|mp4|flv|avi|mov|rmvb|ts|mkv)([?#&]|$)/i;

// 播放器对 URL 中的非 ASCII 字符（如中文片名）兼容性差，统一百分号编码
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
        const mu = /mac_url='([^']*)'/.exec(html);
        const sm = /src-(\d+)/.exec(pid);
        const nm = /num-(\d+)/.exec(pid);
        if (mu && sm && nm) {
            const srcIndex = parseInt(sm[1]) - 1;
            const numIndex = parseInt(nm[1]) - 1;
            const lines = mu[1].split("$$$");
            const playUrls = (lines[srcIndex] || "").split("#");
            const seg = playUrls[numIndex] || "";
            const di = seg.indexOf("$");
            const playUrl = di >= 0 ? seg.substring(di + 1) : seg;
            if (playUrl) {
                // 原始 lazy：走 player 接口换直链
                const playerHtml = await fetchText(PLAYER_API + playUrl, HOST + "/");
                const fm = /"url":\s*"([^"]+)"/.exec(playerHtml);
                if (fm && fm[1]) {
                    return JSON.stringify({ parse: 0, playUrl: "", url: encodeNonAscii(fm[1]), header: { "User-Agent": UA } });
                }
                // 兜底：mac_url 本身即直链时直接播
                if (MEDIA_RE.test(playUrl)) {
                    return JSON.stringify({ parse: 0, playUrl: "", url: encodeNonAscii(playUrl), header: { "User-Agent": UA } });
                }
            }
        }
        // 全部失败回退内置嗅探
        return JSON.stringify({ parse: 1, playUrl: "", url: playPageUrl, header: { "User-Agent": UA } });
    } catch (e) {
        console.error("播放失败:", e.message);
        return JSON.stringify({ parse: 0, playUrl: "", url: "" });
    }
}

export default { init, home, category, detail, search, play };
