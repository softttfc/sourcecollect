/*!
 * @name 西瓜糖音乐(高品质解析)
 * @description 西瓜糖APi，支持Q音的128k和flac
 * @version v1
 * @author 竹佀
 */
const { EVENT_NAMES, request, on, send } = globalThis.lx

const apiKey = '78ba562b6b7de94edb2f4465f1a2a1feaffe9878e3b98385c4d7e7b4cf98a524'

on(EVENT_NAMES.request, async ({ source, action, info }) => {
  if (source !== 'tx' || action !== 'musicUrl') return
  
  const mid = info.musicInfo.mid || info.musicInfo.songmid || info.musicInfo.id
  if (!mid) throw new Error('缺少音乐ID')
  
  const apiUrl = `https://api.nki.pw/API/music_open_api.php?apikey=${apiKey}&mid=${mid}`
  const requestedQuality = info.type || '128k'
  
  console.log(`[高音质版] 请求: MID=${mid}, 音质=${requestedQuality}`)
  
  return new Promise((resolve, reject) => {
    request(apiUrl, {
      method: 'GET',
      timeout: 10000,
      headers: {
        'User-Agent': 'Mozilla/5.0'
      }
    }, (err, resp) => {
      if (err) return reject(new Error('网络请求失败'))
      
      if (!resp.body) return reject(new Error('API返回空数据'))
      
      try {
        const data = typeof resp.body === 'string' ? JSON.parse(resp.body) : resp.body
        
        let audioUrl = null
        
        if (requestedQuality === 'flac') {
          if (data.song_play_url_sq) {
            audioUrl = data.song_play_url_sq
          } else if (data.music_url_sq) {
            audioUrl = data.music_url_sq
          }
        } else {
          if (data.song_play_url) {
            audioUrl = data.song_play_url
          }
        }
        
        if (!audioUrl) {
          if (data.music_url) {
            audioUrl = data.music_url
          } else if (data.url) {
            audioUrl = data.url
          } else if (data.data && typeof data.data === 'string' && data.data.startsWith('http')) {
            audioUrl = data.data
          }
        }
        
        if (audioUrl) {
          resolve(audioUrl)
        } else {
          reject(new Error(data.msg || `未找到${requestedQuality}音频链接`))
        }
      } catch {
        if (resp.body.includes('http')) {
          resolve(resp.body.trim())
        } else {
          reject(new Error('数据解析失败'))
        }
      }
    })
  })
})

send(EVENT_NAMES.inited, {
  sources: {
    tx: {
      name: 'QQ音乐',
      type: 'music',
      actions: ['musicUrl'],
      qualitys: [
        { 
          type: '128k', 
          label: '标准品质 (192kbps)'
        },
        { 
          type: 'flac', 
          label: '无损品质 (FLAC)'
        }
      ]
    }
  }
})