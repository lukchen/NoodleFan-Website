// 这次安全加固补的几个洞 —— 每个洞配一条测试,免得以后重构时悄悄改回去。
import { describe, it, expect } from 'vitest'
import { resolvePoint } from '../supabase/functions/_shared/points.ts'
import { corsHeaders, timingSafeEqual } from '../supabase/functions/_shared/cors.ts'

describe('取餐点只认 id,其余由服务端查表', () => {
  it('三个合法 id 都能查到,kind 由服务端说了算', () => {
    expect(resolvePoint('store').kind).toBe('store')
    expect(resolvePoint('allston').kind).toBe('dropoff')
    expect(resolvePoint('malden').kind).toBe('dropoff')
  })

  it('认不出的 id 一律拒单,不给默认值', () => {
    for (const bad of ['', 'STORE', 'allston ', 'nope', null, undefined, 42, {}, ['store']]) {
      expect(() => resolvePoint(bad)).toThrow(/invalid pickup point/)
    }
  })

  it('前端伪造的 kind / nameZh 进不来 —— 返回的对象只来自查表', () => {
    // 这正是补掉的洞:传 kind:'store' 曾能绕过每道菜 15 份的备料上限
    const p = resolvePoint('allston')
    expect(p.kind).toBe('dropoff')
    expect(p.nameZh).toBe('Allston 取餐点')
  })

  it('原型链上的键不算合法取餐点', () => {
    // POINTS 用普通对象字面量时,POINTS['constructor'] 返回的是
    // Object.prototype.constructor(一个真值),resolvePoint 就不抛错了 ——
    // 拿到的东西 kind 是 undefined,于是 isDropoff=false,每道菜 15 份的上限被绕开。
    expect(() => resolvePoint('constructor')).toThrow()
    expect(() => resolvePoint('toString')).toThrow()
    expect(() => resolvePoint('__proto__')).toThrow()
  })
})

describe('CORS 来源白名单', () => {
  const headersFor = (origin) =>
    corsHeaders(new Request('https://x.test', origin ? { headers: { Origin: origin } } : undefined))

  it('自己的域名放行', () => {
    for (const o of [
      'https://noodlefanboston.com',
      'https://www.noodlefanboston.com',
      'https://lukchen.github.io',
      'http://localhost:5173',
    ]) {
      expect(headersFor(o)['Access-Control-Allow-Origin'], o).toBe(o)
    }
  })

  it('别人的站点不回 Allow-Origin(而不是回 *)', () => {
    for (const o of [
      'https://evil.example',
      'https://noodlefanboston.com.evil.example',
      'http://noodlefanboston.com',          // 明文 http 不在名单里
      'https://sub.noodlefanboston.com',
    ]) {
      expect(headersFor(o)['Access-Control-Allow-Origin'], o).toBeUndefined()
    }
  })

  it('没有 Origin 的请求照常放行 —— Stripe webhook 和定时任务不带这个头', () => {
    const h = headersFor(null)
    expect(h['Access-Control-Allow-Origin']).toBeUndefined()
    expect(h['Access-Control-Allow-Methods']).toContain('POST')
  })

  it('带 Vary: Origin,免得 CDN 把某一个来源的响应缓存给所有人', () => {
    expect(headersFor('https://noodlefanboston.com')['Vary']).toBe('Origin')
  })
})

describe('管理员密码恒定时间比对', () => {
  it('相等为真,含多字节字符也一样', () => {
    expect(timingSafeEqual('hunter2', 'hunter2')).toBe(true)
    expect(timingSafeEqual('密码abc', '密码abc')).toBe(true)
  })

  it('差一个字符、差大小写、差长度都为假', () => {
    expect(timingSafeEqual('hunter2', 'hunter3')).toBe(false)
    expect(timingSafeEqual('hunter2', 'Hunter2')).toBe(false)
    expect(timingSafeEqual('hunter2', 'hunter')).toBe(false)
    expect(timingSafeEqual('hunter2', 'hunter2 ')).toBe(false)
  })

  it('空密码不等于任意密码 —— ADMIN_PASSWORD 没设时不能变成人人可进', () => {
    expect(timingSafeEqual('', 'anything')).toBe(false)
    expect(timingSafeEqual('anything', '')).toBe(false)
    // 两边都空只在 secret 缺失且请求也不传密码时出现,由调用方另行拦截
    expect(timingSafeEqual('', '')).toBe(true)
  })

  it('前缀相同但更短的密码不算通过', () => {
    expect(timingSafeEqual('hunter2secret', 'hunter2')).toBe(false)
  })
})
