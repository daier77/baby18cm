/**
 * 已用流量统计版（极致兼容）
 * 格式：♾️ MM.DD HH:mm | Y已用 L已用 P已用 | 12⏰
 */
async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  
  const stats = {
    ykk: 0,
    lx: 0,
    pq: 0
  }
  
  let lastUpdate = ''
  let resetDisplay = ''
  const subNames = new Set()

  // 1. 遍历节点，找到它们所属的所有订阅源
  for (const p of proxies) {
    const sName = p._subName || p.subName
    if (sName && !subNames.has(sName)) {
      subNames.add(sName)
      const sub = context.source[sName]
      if (sub) {
        try {
          // 获取流量数据
          const flowInfo = await getFlowHeaders(sub.url, undefined, undefined, sub.proxy, sub.subUserinfo)
          if (flowInfo) {
            const headers = normalizeFlowHeader(flowInfo, true)
            const info = headers?.['subscription-userinfo']
            if (info) {
              const { usage } = parseFlowHeaders(info)
              const usedVal = usage.upload + usage.download
              const raw = typeof flowInfo === 'string' ? flowInfo : JSON.stringify(flowInfo)
              const ext = parseFields(raw)

              // 2. 根据订阅源名字或节点名字识别分类
              const label = (sName + (p.name || '')).toLowerCase()
              if (label.includes('ykk')) stats.ykk += usedVal
              else if (label.includes('良心')) stats.lx += usedVal
              else if (label.includes('赔钱')) stats.pq += usedVal

              if (!lastUpdate && ext.last_update) lastUpdate = ext.last_update
              if (!resetDisplay) resetDisplay = formatReset(ext)
            }
          }
        } catch (e) {}
      }
    }
  }

  // 3. 流量单位转换（显示已用数值）
  const getUsedStr = (bytes) => {
    if (bytes === 0) return '0M'
    const t = flowTransfer(bytes)
    const unit = t.unit.charAt(0).toUpperCase()
    return `${t.value}${unit}`
  }

  const yUsed = getUsedStr(stats.ykk)
  const lUsed = getUsedStr(stats.lx)
  const pUsed = getUsedStr(stats.pq)

  // 4. 组装显示
  const now = new Date()
  const timeStr = lastUpdate 
    ? lastUpdate.slice(5, 16).replace(/-/g, '.') 
    : `${String(now.getMonth() + 1).padStart(2, '0')}.${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`
  
  const finalName = `♾️ ${timeStr} | Y${yUsed} L${lUsed} P${pUsed} | ${resetDisplay || '12⏰'}`

  // 5. 插入节点
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
