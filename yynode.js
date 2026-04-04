/**
 * 终极变色预警版（双数据源精准获取）
 * 数据源 1：固定 URL 抓取精准流量 + 变色
 * 数据源 2：节点反查订阅 URL 获取动态时间与重置
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { getFlowHeaders, flowTransfer } = flowUtils

  const URL_MAP = {
    ykk: 'http://192.168.124.42:8299/sb9ht4Qn0o3sv1uFqZfM/download/YKK',
    lx: 'https://liangxin.xyz/api/v1/liangxin?OwO=dd8c814e769a5eb94f0a8d39662ff958',
    pq: 'https://dash.pqjc.site/api/v1/pq/5e3d9a386e2d26d34de25800b4acc3be'
  }
  const TOTAL_GB = { ykk: 150, lx: 500, pq: 500 }

  const stats = { ykk: 0, lx: 0, pq: 0 }
  let lastUpdate = '', resetDisplay = ''

  // =========================
  // 数据源 1：流量抓取 (固定 URL)
  // =========================
  for (const type of ['ykk', 'lx', 'pq']) {
    try {
      const flowInfo = await getFlowHeaders(URL_MAP[type])
      if (flowInfo) {
        const raw = typeof flowInfo === 'string' ? flowInfo : JSON.stringify(flowInfo)
        const uMatch = raw.match(/upload=(\d+)/)
        const dMatch = raw.match(/download=(\d+)/)
        if (uMatch && dMatch) {
          stats[type] = parseInt(uMatch[1], 10) + parseInt(dMatch[1], 10)
        }
      }
    } catch (e) {}
  }

  // =========================
  // 数据源 2：时间与重置抓取 (节点反查)
  // =========================
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
            const ext = parseFields(raw)
            
            // 将连字符替换为斜杠
            if (!lastUpdate && ext.last_update) {
              lastUpdate = ext.last_update.slice(5, 16).replace(/-/g, '/')
            }
            if (type === 'pq' && (ext.reset_day || ext.reset_hour)) {
              resetDisplay = formatReset(ext)
            } else if (!resetDisplay && (ext.reset_day || ext.reset_hour)) {
              resetDisplay = formatReset(ext)
            }
          }
        } catch (e) {}
      }
      checkedSubs.add(sName)
    }
  }

  // =========================
  // 颜色预警与流量取整
  // =========================
  const getTrafficInfo = (usedBytes, totalGb) => {
    if (!usedBytes || usedBytes === 0) return '0🟢'
    const t = flowTransfer(usedBytes)
    const integerVal = Math.floor(parseFloat(t.value))
    
    const ratio = usedBytes / (totalGb * 1073741824)
    let color = '🟢'
    if (ratio >= 0.8) color = '🔴'
    else if (ratio >= 0.5) color = '🟡'
    
    return `${integerVal}${color}`
  }

  const yStr = getTrafficInfo(stats.ykk, TOTAL_GB.ykk)
  const lStr = getTrafficInfo(stats.lx, TOTAL_GB.lx)
  const pStr = getTrafficInfo(stats.pq, TOTAL_GB.pq)

  // =========================
  // 最终组装
  // =========================
  if (lastUpdate) {
    lastUpdate = decodeURIComponent(lastUpdate).replace(/\s+/g, ' ')
  }
  
  const finalName = `${lastUpdate || '未更新'} | Y${yStr} L${lStr} P${pStr} | ${resetDisplay || '0⏰'}`

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
    if (ext.reset_day) return `${ext.reset_day}⏰`
    if (ext.reset_hour) return `${ext.reset_hour}⏰`
    return ''
  }
}
