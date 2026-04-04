/**
 * 终极修正版：流量取整显示
 * 格式：♾️ MM.DD HH:mm | Y83G L0M P76G | ⏰
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils

  // --- 请在此处确认订阅链接是否正确 ---
  const URL_MAP = {
    ykk: 'http://192.168.124.42:8299/sb9ht4Qn0o3sv1uFqZfM/download/YKK',
    lx: 'https://liangxin.xyz/api/v1/liangxin?OwO=dd8c814e769a5eb94f0a8d39662ff958',
    pq: 'https://dash.pqjc.site/api/v1/pq/5e3d9a386e2d26d34de25800b4acc3be'
  }

  const stats = { ykk: 0, lx: 0, pq: 0 }
  let lastUpdate = '', resetDisplay = ''

  for (const type of ['ykk', 'lx', 'pq']) {
    const url = URL_MAP[type]
    if (!url) continue

    try {
      const flowInfo = await getFlowHeaders(url)
      if (flowInfo) {
        const raw = typeof flowInfo === 'string' ? flowInfo : JSON.stringify(flowInfo)
        const uMatch = raw.match(/upload=(\d+)/)
        const dMatch = raw.match(/download=(\d+)/)
        
        if (uMatch && dMatch) {
          const usedBytes = parseInt(uMatch[1], 10) + parseInt(dMatch[1], 10)
          stats[type] = usedBytes
        }

        const ext = parseFields(raw)
        if (!lastUpdate && ext.last_update) lastUpdate = ext.last_update
        if (!resetDisplay && type === 'pq') resetDisplay = formatReset(ext)
      }
    } catch (e) {
      $.error(`${type} 抓取失败`)
    }
  }

  // 流量格式化：强制取整
  const formatUsed = (bytes) => {
    if (!bytes || bytes === 0) return '0M'
    const t = flowTransfer(bytes)
    // 使用 Math.floor 丢弃小数部分
    const integerVal = Math.floor(parseFloat(t.value))
    const unit = t.unit.charAt(0).toUpperCase()
    return `${integerVal}${unit}`
  }

  const yStr = formatUsed(stats.ykk)
  const lStr = formatUsed(stats.lx)
  const pStr = formatUsed(stats.pq)

  const now = new Date()
  const timeStr = lastUpdate ? lastUpdate.slice(5, 16).replace(/-/g, '.') : 
    `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`

  const finalName = `♾️ ${timeStr} | Y${yStr} L${lStr} P${pStr} | ${resetDisplay || '⏰'}`

  const TYPES = new Set(['ss', 'trojan', 'vmess', 'vless', 'hysteria2'])
  const lastNode = proxies.find(p => TYPES.has(p.type?.toLowerCase()))
  const dummy = { type: 'ss', server: '1.0.0.1', port: 443, cipher: 'aes-128-gcm', password: 'password' }

  proxies.unshift({
    ...(lastNode || dummy),
    name: finalName
  })

  return proxies

  function parseFields(raw = '') {
    const res = {}
    raw.split(/[;,]/).forEach(s => {
      const i = s.indexOf('=')
      if (i !== -1) res[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    })
    return res
  }

  function formatReset(ext) {
    if (ext.reset_day && parseInt(ext.reset_day) > 0) return `${ext.reset_day}d⏰`
    if (ext.reset_hour) return `${ext.reset_hour}⏰`
    return ''
  }
}
