/*!
 * @name bimiao音源
 * @description 仅网易，全音质，具体自测
 * @version v1.1
 * @author 玥然OvO
 */

const { EVENT_NAMES, request, on, send } = globalThis.lx

const API_BASE = 'https://www.cunyuapi.top'

const QUALITY_MAP = {
    '128k': 'standard',
    '320k': 'standard',
    'flac': 'lossless',
    'hires': 'hires',
    'atmos': 'jyeffect',
    'atmos_plus': 'sky',
    'master': 'jymaster'
}

const getAudioUrl = (musicInfo, quality = '128k') => {
    return new Promise((resolve, reject) => {
        const id = musicInfo.songmid || musicInfo.id || musicInfo.mid
        if (!id) return reject(new Error('缺少歌曲ID'))
        
        const apiUrl = `${API_BASE}/163music_play?id=${id}&quality=${QUALITY_MAP[quality] || 'standard'}`
        
        request(apiUrl, { method: 'GET', timeout: 10000 }, (err, resp) => {
            if (err) return reject(new Error('网络请求失败'))
            
            try {
                let data = resp.body
                if (typeof data === 'string') data = JSON.parse(data.trim())
                if (data.status !== 200 || !data.song_file_url) return reject(new Error('获取音频地址失败'))
                
                const fileType = quality.includes('flac') || quality === 'hires' || quality === 'master' ? 'flac' : 'mp3'
                
                resolve({
                    url: data.song_file_url,
                    type: fileType
                })
            } catch {
                reject(new Error('解析响应数据失败'))
            }
        })
    })
}

on(EVENT_NAMES.request, ({ action, info }) => {
    switch (action) {
        case 'musicUrl':
            return getAudioUrl(info.musicInfo, info.type || '128k').then(res => res.url)
            
        case 'download':
            return getAudioUrl(info.musicInfo, info.type || '128k')
            
        default:
            return Promise.reject(new Error('不支持的操作'))
    }
})

send(EVENT_NAMES.inited, {
    openDevTools: false,
    sources: {
        wy: {
            name: '网易云音乐',
            type: 'music',
            actions: ['musicUrl', 'download'],
            qualitys: ['128k', '320k', 'flac', 'hires', 'atmos', 'atmos_plus', 'master']
        }
    }
})