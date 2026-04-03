async function operator(proxies = [], targetPlatform, context) {
  let args = $arguments || {}
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  const sub = context.source[proxies?.[0]?._subName || proxies?.[0]?.subName]
  let subInfo, flowInfo, rawSubInfo = ''

  if (sub.source !== 'local' || ['localFirst', 'remoteFirst'].includes(sub.mergeSources)) {
    try {
      let url = `${sub.url}`.split(/[\r\n]+/)[0] || ''
      let urlArgs = {}
      let rawArgs = url.split('#')
      url = rawArgs[0]
      if (rawArgs.length > 1) {
        try {
          urlArgs = JSON.parse(decodeURIComponent(rawArgs[1]))
        } catch (e) {
          for (const pair of rawArgs[1].split('&')) {
            const [key, value] = pair.split('=')
            urlArgs[key] = value == null || value === '' ? true : decodeURIComponent(value)
          }
        }
      }
      if (!urlArgs.noFlow && /^https?/.test(url)) {
        flowInfo = await getFlowHeaders(urlArgs?.insecure ? `${url}#insecure` : url, urlArgs.flowUserAgent, undefined, sub.proxy, urlArgs.flowUrl)
        if (flowInfo) {
          const headers = normalizeFlowHeader(flowInfo, true)
          if (headers?.['subscription-userinfo']) subInfo = headers['subscription-userinfo']
        }
      }
      args = { ...urlArgs, ...args }
    } catch (err) {}
  }

  if (sub.subUserinfo) {
    let subUserInfo
    if (/^https?:\/\//.test(sub.subUserinfo)) {
      try {
        subUserInfo = await getFlowHeaders(undefined, undefined, undefined, sub.proxy, sub.subUserinfo)
      } catch (e) {}
    } else {
      subUserInfo = sub.subUserinfo
    }
    const parts = [subUserInfo, flowInfo].filter(i => i != null).map(i => (typeof i === 'string' ? i : JSON.stringify(i)))
    const headers = normalizeFlowHeader(parts.join(';'), true)
    if (headers?.['subscription-userinfo']) {
      subInfo = headers['subscription-userinfo']
      rawSubInfo = parts.join(';')
    }
  }

  function parseExtendedFields(raw = '') {
    const result = {}
    for (const segment of raw.split(/[;,]/)) {
      const eqIdx = segment.indexOf('=')
      if (eqIdx === -1) continue
      const key = segment.slice(0, eqIdx).trim()
      let value = segment.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, '')
      try { value = decodeURIComponent(value) } catch (e) {}
      result[key] = value
    }
    return result
  }

  function formatResetTime(extFields) {
    const nextUpdateStr = extFields['next_update']
    const resetHourStr = extFields['reset_hour']
    const resetDayStr = extFields['reset_day']
    
    if (nextUpdateStr) {
      const nextTime = new Date(nextUpdateStr.replace(' ', 'T'))
      if (!isNaN(nextTime.getTime()) && nextTime.getTime() - Date.now() <= 0) return '可更新'
    }
    if (resetDayStr != null && resetDayStr !== '') {
      const days = parseInt(resetDayStr, 10)
      if (!isNaN(days) && days > 0) return `${days}d⏰`
    }
    if (resetHourStr != null && resetHourStr !== '') {
      const hour = parseInt(resetHourStr, 10)
      if (!isNaN(hour)) return `${hour}⏰`
    }
    return ''
  }

  if (subInfo) {
    let { total, usage: { upload, download } } = parseFlowHeaders(subInfo)
    const extFields = parseExtendedFields(rawSubInfo)
    const lastUpdate = extFields['last_update']
    let show = upload + download
    if (args.showRemaining) show = total - show
    const showT = flowTransfer(Math.abs(show))
    
    let infoName = ''
    if (args.showLastUpdate && lastUpdate) {
      // 强制替换所有横杠为点
      const shortTime = lastUpdate.slice(5, 16).replace(/-/g, '.')
      infoName = `${shortTime} | ${showT.value} ${showT.unit}`
      const resetStr = formatResetTime(extFields)
      if (resetStr) infoName += ` | ${resetStr}`
    } else {
      const totalT = flowTransfer(total)
      infoName = `${showT.value} ${showT.unit} / ${totalT.value} ${totalT.unit}`
    }

    const COMPATIBLE_TYPES = new Set(['ss', 'trojan', 'vmess', 'vless'])
    const lastProxy = proxies[proxies.length - 1]
    const node = lastProxy && COMPATIBLE_TYPES.has(lastProxy.type?.toLowerCase())
    const dummyNode = { type: 'ss', server: '1.0.0.1', port: 443, cipher: 'aes-128-gcm', password: 'password' }

    // 重新封装节点，彻底抛弃旧节点的所有名称字段
    const finalProxy = {
      ...(node ? lastProxy : dummyNode),
      name: `♾️ ${infoName}`
    }
    proxies.unshift(finalProxy)
  }

  return proxies
}
