async function operator(proxies = [], targetPlatform, context) {
  const $ = $substore
  const { parseFlowHeaders, getFlowHeaders, flowTransfer, normalizeFlowHeader } = flowUtils
  const sub = context.source[proxies?.[0]?._subName || proxies?.[0]?.subName]
  let args = $arguments || {}
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
            const [k, v] = pair.split('=')
            urlArgs[k] = v == null || v === '' ? true : decodeURIComponent(v)
          }
        }
      }
      if (!urlArgs.noFlow && /^https?/.test(url)) {
        flowInfo = await getFlowHeaders(urlArgs?.insecure ? `${url}#insecure` : url, urlArgs.flowUserAgent, undefined, sub.proxy, urlArgs.flowUrl)
        if (flowInfo) {
          const h = normalizeFlowHeader(flowInfo, true)
          if (h?.['subscription-userinfo']) subInfo = h['subscription-userinfo']
        }
      }
      args = { ...urlArgs, ...args }
    } catch (e) {}
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
    const h = normalizeFlowHeader(parts.join(';'), true)
    if (h?.['subscription-userinfo']) {
      subInfo = h['subscription-userinfo']
      rawSubInfo = parts.join(';')
    }
  }

  function parse(raw = '') {
    const res = {}
    raw.split(/[;,]/).forEach(s => {
      const i = s.indexOf('=')
      if (i !== -1) res[s.slice(0, i).trim()] = s.slice(i + 1).trim().replace(/^['"]|['"]$/g, '')
    })
    return res
  }

  if (subInfo) {
    let { total, usage: { upload, download } } = parseFlowHeaders(subInfo)
    const ext = parse(rawSubInfo)
    const lastUpdate = ext['last_update'] || ''
    const resetHour = ext['reset_hour'] || ''
    const resetDay = ext['reset_day'] || ''
    
    let used = upload + download
    if (args.showRemaining) used = total - used
    const sT = flowTransfer(Math.abs(used))
    
    let info = ''
    if (args.showLastUpdate && lastUpdate) {
      // 核心修改：全局替换横杠为点，只截取月日时分
      const time = lastUpdate.slice(5, 16).replace(/-/g, '.')
      info = `${time} | ${sT.value} ${sT.unit}`
      
      // 核心修改：极致精简重置时间，不带“点重置”字样
      if (resetDay && parseInt(resetDay) > 0) {
        info += ` | ${resetDay}d⏰`
      } else if (resetHour) {
        info += ` | ${resetHour}⏰`
      }
    } else {
      const tT = flowTransfer(total)
      info = `${sT.value} ${sT.unit} / ${tT.value} ${tT.unit}`
    }

    const TYPES = new Set(['ss', 'trojan', 'vmess', 'vless'])
    const last = proxies[proxies.length - 1]
    const isNode = last && TYPES.has(last.type?.toLowerCase())
    const dummy = { type: 'ss', server: '1.0.0.1', port: 443, cipher: 'aes-128-gcm', password: 'password' }

    // 核心修改：强制覆盖 name，完全抹除旧名称、后缀和国旗
    proxies.unshift({
      ...(isNode ? last : dummy),
      name: `♾️ ${info}`
    })
  }

  return proxies
}
