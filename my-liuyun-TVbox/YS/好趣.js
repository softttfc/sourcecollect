// 好趣网 (tv.haoqu99.com) 电视直播
// drpy1 rule 格式（与 maoystv/drpy2.min.js 完全兼容）
// 编码：GBK；播放：tv.php → signal → 多层嗅探 → m3u8
var rule = {
	title: '好趣网',
	编码: 'GBK',
	搜索编码: 'GBK',
	host: 'http://tv.haoqu99.com',
	url: '/fyclass',
	searchUrl: '/e/sch/index.php?page=fypage&keyboard=**&sear=1',
	searchable: 2,
	quickSearch: 0,
	headers: {
		'User-Agent': 'MOBILE_UA'
	},
	timeout: 5000,
	class_name: '央视&卫视频道&港澳台频道&国外电视台&广东&湖南&江苏&安徽&浙江&北京&辽宁&江西&山东&黑龙江&上海&云南&四川&河南&湖北&福建&重庆&河北&吉林&广西&山西&陕西&宁夏&海南&甘肃&新疆&内蒙古&天津&贵州&青海&西藏',
	class_url: '1&2&4&5&3/guangdong&3/hunan&3/jiangsu&3/anhui&3/zhejiang&3/beijing&3/liaoning&3/jiangxi&3/shandong&3/heilongjiang&3/shanghai&3/yunnan&3/sichuan&3/henan&3/hubei&3/fujian&3/zhongqing&3/hebei&3/jilin&3/guangxi&3/shan-xi&3/shanxi&3/ningxia&3/hainan&3/gansu&3/xinjiang&3/neimenggu&3/tianjin&3/guizhou&3/qinghai&3/xizang',
	play_parse: true,
	limit: 6,

	// ============ 修复后的 lazy：多层嗅探拿到真实 m3u8 ============
	// 直接用单行字符串（JS 自动去换行），双层转义保证正则正确
	lazy: 'js:' +
	'(function sniff(input){var MAX_DEPTH=4;' +
	'function isM3u8Url(u){return/^https?:\\/\\/.*\\.(m3u8|mp4|flv|mkv|ts)(\\?|$)/i.test(u||"")};' +
	'function looksM3u8(s){if(!s)return false;var h=s.substring(0,200).trim();return h.indexOf("#EXTM3U")===0||h.indexOf("#EXT-X-VERSION")>=0};' +
	'function abs(u,base){if(/^https?:\\/\\//i.test(u))return u;try{return new URL(u,base).href}catch(e){return u}};' +
	'function recurse(url,depth){if(depth>MAX_DEPTH)return"";if(!/^https?:\\/\\//i.test(url))return"";' +
	'var html=request(url);if(!html)return"";if(looksM3u8(html)||html.indexOf("#EXTM3U")===0)return url;if(html.indexOf("<")<0&&html.length>100)return url;' +
	'var sm=html.match(/signal\\s*=\\s*[\'""]([^\'""]+)[\'""]/);if(sm){var parts=sm[1].split("$");if(parts.length>=3){var sUrl=parts[1],sType=(parts[2]||"").toLowerCase();if(/iframe|h5vjs|h5xg/i.test(sType))return recurse(sUrl,depth+1);if(/m3u8|ckx/i.test(sType)||isM3u8Url(sUrl))return sUrl}};' +
	'if(/hefei\\.html/i.test(url)){var vm=url.match(/[?&]id=([^&]+)/);if(vm){var tries=["https://app.hfbtc.cn/shows/2/"+vm[1]+".html"];for(var i=0;i<tries.length;i++){var t=request(tries[i]);var src=t&&t.match(/source\\s+src\\s*=\\s*[\'"]([^\'""]+)[\'"]/);if(src&&isM3u8Url(src[1]))return src[1]}}};' +
	'var cfg=html.match(/config\\s*=\\s*\\{[\\s\\S]*?"url"\\s*:\\s*[\'"]([^\'""]+)[\'"]/);if(cfg&&cfg[1]){var r=recurse(cfg[1],depth+1);if(r)return r};' +
	'var mre=/(https?:\\/\\/[^\\s\'"<>]+\\.m3u8[^\\s\'"<>]*)/g,m2;while((m2=mre.exec(html))!==null){var r2=recurse(m2[1],depth+1);if(r2)return r2};' +
	'var lm=html.match(/location\\.(?:href|replace)\\s*=\\s*[\'"]([^\'""]+)[\'"]/);if(lm&&lm[1]!==url){var r3=recurse(abs(lm[1],url),depth+1);if(r3)return r3};' +
	'var ifm=html.match(/<iframe[^>]+src=[\'"]([^\'""]+)[\'"]/);if(ifm&&ifm[1]){var u=abs(ifm[1],url);if(u!==url){var r4=recurse(u,depth+1);if(r4)return r4}};' +
	'var xm=html.match(/(?:open|\\.open)\\s*\\(\\s*[\'"](GET|POST)[\'"]\\s*,\\s*[\'"]([^\'""]+)[\'"]/);if(xm&&xm[2]){var r5=recurse(abs(xm[2],url),depth+1);if(r5)return r5};' +
	'var am=html.match(/url\\s*:\\s*[\'"]([^\'""]+)[\'"]/);if(am&&am[1]&&am[1]!==url){var r6=recurse(abs(am[1],url),depth+1);if(r6)return r6};' +
	'return""};' +
	'var result=recurse(input,0);if(result){input=result}})()',

	// ============ 首页推荐 ============
	推荐: '.p-list-sya&&li;.s&&Text;img&&src;;a&&href',

	// ============ 一级分类 ============
	一级: '.bx-sya&&li;span&&Text;img&&src;;a&&href',

	// ============ 详情 ============
	二级: {
		'title': 'strong.t&&Text;.v-top&&a:eq(1)&&Text',
		'img': '.drop-panel:eq(1)&&img&&src',
		'desc': ';;;;',
		'content': '.drop-panel:eq(1)&&p:eq(2)&&Text',
		'tabs': 'js:TABS=["播放源"]',
		// 从 .tab-list-syb li 提取线路按钮，每个按钮的 data-player 就是 sourid
		'lists': 'js:' +
			'let d=[];' +
			'pd=jsp.pd;pdfh=jsp.pdfh;pdfa=jsp.pdfa;' +
			'function getLists(html){' +
			'  let src=pdfa(html,".tab-list-syb&&li");' +
			'  let list=[];' +
			'  src.forEach(function(it){' +
			'    let title=pdfh(it,".s&&Text");' +
			'    let url="http://m.haoqu99.com/e/extend/tv.php?id="+pd(it,".tab-item&&data-player");' +
			'    list.push({title:title,url:url});' +
			'  });' +
			'  return{list:list};' +
			'}' +
			'var data=getLists(html);' +
			'var list=data.list;' +
			'list=list.map(function(item){return(item.title+"$"+item.url)});' +
			'LISTS=[list];'
	},

	// ============ 搜索 ============
	搜索: 'div.list-box.J-medal&&li;a&&Text;;;a&&href',
};