/**
 * Sub-Store 脚本操作 · 批量改写 vmess/vless 的 Host / SNI / path / port
 *
 * 参数（脚本链接 # 后，或脚本操作底部「参数编辑」）：
 *   host hostPrefix hostSuffix
 *   port portPrefix portSuffix
 *   path pathPrefix pathSuffix defaultPath(=/) method defaultMethod(=GET)
 *   array=1              让 h2 / http 的 Host 写成数组
 *   defaultNetwork(=http) 节点未写 network 时补的传输层
 *   realityMode(=skip)   skip = reality 整条跳过 | name = 只给 reality 改 name
 *
 * 用法：订阅编辑 → 脚本操作 → 类型「脚本」→ 粘贴本文件 →
 *      链接或参数编辑里填 #host=cdn.example.com&port=443 → 保存 → 预览
 */
function operator(proxies = [], targetPlatform, context) {
  const _ = lodash
  const args = typeof $arguments === 'object' && $arguments !== null ? $arguments : {}
  const A = k => _.get(args, k)
  const on = v => v === true || v === 1 ||
    ['1', 'true', 'yes', 'on'].indexOf(String(v).toLowerCase()) >= 0

  const host = A('host')
  const hostPrefix = A('hostPrefix')
  const hostSuffix = A('hostSuffix')
  const rawPort = A('port')
  const portNum = Number(rawPort)
  const port = rawPort === undefined || rawPort === null || rawPort === ''
    ? undefined
    : (Number.isFinite(portNum) && portNum > 0 ? portNum : undefined)
  const portPrefix = A('portPrefix')
  const portSuffix = A('portSuffix')
  const defaultPath = A('defaultPath') || '/'
  const argPath = A('path')
  const pathPrefix = A('pathPrefix')
  const pathSuffix = A('pathSuffix')
  const defaultMethod = A('defaultMethod') || 'GET'
  const method = A('method')
  const array = on(A('array'))
  const defaultNetwork = A('defaultNetwork') || 'http'
  const realityMode = A('realityMode') || 'skip'

  return (proxies || []).map((p = {}) => {
    const type = _.get(p, 'type')
    if (!_.includes(['vmess', 'vless'], type)) return p

    /* FIX 1: reality 的 SNI 必须与真实证书域名一致，整条跳过 */
    const isReality = Boolean(
      _.get(p, 'reality-opts') ||
      _.get(p, 'reality') ||
      _.get(p, 'reality-opts.public-key')
    )
    if (isReality) {
      if (realityMode === 'name' && host) {
        if (hostPrefix) _.set(p, 'name', String(hostPrefix) + p.name)
        if (hostSuffix) _.set(p, 'name', p.name + String(hostSuffix))
      }
      return p
    }

    let network = _.get(p, 'network')
    if (!network) {
      network = defaultNetwork
      _.set(p, 'network', defaultNetwork)
    }

    if (host) {
      if (hostPrefix) _.set(p, 'name', String(hostPrefix) + p.name)
      if (hostSuffix) _.set(p, 'name', p.name + String(hostSuffix))
      _.set(p, 'servername', host)
      if (_.get(p, 'tls')) {
        _.set(p, 'skip-cert-verify', true)
        _.set(p, 'sni', host)
      }
      if (network === 'ws') _.set(p, 'ws-opts.headers.Host', host)
      else if (network === 'h2') _.set(p, 'h2-opts.host', array ? [host] : host)
      else if (network === 'http') _.set(p, 'http-opts.headers.Host', array ? [host] : host)
      else _.set(p, String(network) + '-opts.headers.Host', host)
    }

    /* FIX 4: path 用节点内局部变量，避免 http 节点算出的默认值污染后续节点 */
    let nodePath = argPath
    if (network === 'http') {
      /* FIX 2: 不再用 undefined 抹掉节点已有的 method */
      _.set(p, 'http-opts.method', method || _.get(p, 'http-opts.method') || defaultMethod)
      /* FIX 3: 用户传入的 path 优先，不再被节点原值覆盖 */
      if (!nodePath) {
        let currentPath = _.get(p, 'http-opts.path')
        if (_.isArray(currentPath)) currentPath = _.find(currentPath, i => _.startsWith(i, '/'))
        nodePath = _.startsWith(currentPath, '/') ? currentPath : defaultPath
      }
    }

    if (port) {
      _.set(p, 'port', port)
      if (portPrefix) _.set(p, 'name', String(portPrefix) + p.name)
      if (portSuffix) _.set(p, 'name', p.name + String(portSuffix))
    }

    if (nodePath) {
      if (pathPrefix) _.set(p, 'name', String(pathPrefix) + p.name)
      if (pathSuffix) _.set(p, 'name', p.name + String(pathSuffix))
      if (network === 'ws') _.set(p, 'ws-opts.path', nodePath)
      else if (network === 'h2') _.set(p, 'h2-opts.path', nodePath)
      else if (network === 'http') _.set(p, 'http-opts.path', array ? [nodePath] : nodePath)
      else _.set(p, String(network) + '-opts.path', nodePath)
    }

    return p
  })
}
