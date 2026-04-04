/**
 * 终极修正版：流量数据精准对齐
 * 逻辑：直接正则抓取已用流量字段，不经过中间函数转换
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  
  const stats = { ykk: 0, lx: 0, pq: 0 }
  let lastUpdate = '', resetDisplay = ''
  const checkedSubs = new Set()

  for (const p of proxies) {
    const sName = p._subName || p.subName
    if (!sName || checkedSubs.has(sName)) continue

    const pName = (p.name || '').toLowerCase()
    let type = ''
    if (pName.includes('ykk')) type = 'ykk'
    else if (pName.includes('良心')) type = 'lx'
    else if (pName.includes('赔钱')) type = 'pq'

    if (type) {
      const sub = context.source[sName]
      if (sub && sub.url) {
        try {
          const flowInfo = await getFlowHeaders(sub.url, undefined, undefined, sub.proxy, sub.subUserinfo)
          if (flowInfo) {
            const raw = typeof flowInfo === 'string' ? flowInfo : JSON.stringify(flowInfo)
            
            // 核心修复：直接从响应头字符串中正则提取 upload 和 download
            // 格式通常为：upload=xxx; download=xxx; total=xxx;
            const uMatch = raw.match(/upload=(\d+)/)
            const dMatch = raw.match(/download=(\d+)/)
            
            if (uMatch && dMatch) {
              const usedBytes = parseInt(uMatch[1], 10) + parseInt(dMatch[1], 10)
              stats[type] += usedBytes
            }

            const ext = parseFields(raw)
            if (!lastUpdate && ext.last_update) lastUpdate = ext.last_update
            if (!resetDisplay) resetDisplay = formatReset(ext)
          }
        } catch (e) {}
      }
      checkedSubs.add(sName)
    }
  }

  // 流量格式化 (强制转为 G 或 M，不显示多余小数)
  const formatUsed = (bytes) => {
    if (!bytes || bytes === 0) return '0M'
    const t = flowTransfer(bytes)
    // 保持单位首字母大写
    return `${t.value}${t.unit.charAt(0).toUpperCase()}`
  }

  const yStr = formatUsed(stats.ykk)
  const lStr = formatUsed(stats.lx)
  const pStr = formatUsed(stats.pq)

  const now = new Date()
  let timeStr = lastUpdate ? lastUpdate.slice(5, 16).replace(/-/g, '.') : 
    `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  timeStr = decodeURIComponent(timeStr).replace(/\s+/g, ' ')
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
