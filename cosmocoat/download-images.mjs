// Run from repo root: node cosmocoat/download-images.mjs
// 强制覆盖已存在文件: node cosmocoat/download-images.mjs --force
//
// CDN 防盗链：必须带 Referer / User-Agent；部分资源需 https。
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../public/cosmocoat')
if (!fs.existsSync(OUT)) fs.mkdirSync(OUT, { recursive: true })

const FORCE = process.argv.includes('--force') || process.argv.includes('-f')

/** 与原站页面一致，绕过图片 CDN 反盗链 */
const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
  'Accept-Language': 'zh-CN,zh;q=0.9,en-US;q=0.8,en;q=0.7',
  Referer: 'http://cosmocoat.cn/',
}

/**
 * @typedef {[string, string | string[]]} ImageEntry
 * 第二个元素为 URL，或按顺序尝试的 URL 列表（首个成功即止）
 */

/** @type {ImageEntry[]} */
const images = [
  [
    'logo.png',
    ['https://cosmocoat.cn/web/images/logo.png', 'http://cosmocoat.cn/web/images/logo.png'],
  ],

  ['hero-banner.jpeg', 'https://cdn.yun.sooce.cn/6/1022/jpeg/1746409207875d78cd30ab41f7c7395456f0587bed9d5.jpeg?version=1746409210'],

  ['home-about-visual.png', 'https://cdn.yun.sooce.cn/6/1022/png/1746417038849def3ee931662a9ce61f2c1e28e8639c8.png?version=0'],
  ['home-feature-side.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/17464983263269dd7fc26e905c752c7566d9baff7d135.jpg?version=0'],
  ['home-product-center.png', 'https://cdn.yun.sooce.cn/6/1022/png/1746413010258370f6789cebbb3de1dae04b4a7cf1f26.png?version=1746413012'],
  ['home-wide-divider.png', 'https://cdn.yun.sooce.cn/6/1022/png/17464322510755db6817b12261542912ee7d1495edae0.png?version=0'],
  ['home-supporting-visual.png', 'https://cdn.yun.sooce.cn/6/1022/png/17464169714132642e094a7339435e976b8ac2b8877de.png?version=1746416973'],
  ['deco-line-gold.png', 'https://cdn.yun.sooce.cn/6/1022/png/1746515058212436daf97c1e5f08c06a0748741e78691.png?version=1746515059'],

  ['wechat-qr.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/1746499038957257b36f30d9d013bbb39c102e5f91571.jpg?version=0'],

  ['about-hero.jpeg', 'https://cdn.yun.sooce.cn/6/1022/jpeg/174650138093714d742c26547afdf1eb68bbad44c4788.jpeg?version=0'],
  ['about-banner-strip.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/174650174946947131fc5d5e1aa4e412627172eac8959.jpg?version=1746501751'],
  ['about-factory-dongguan.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/1746503757709583f3ae339e6003f90c1d1b414edfe37.jpg?version=0'],
  ['about-factory-split.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/1746512759018537ecc469747d4e3563d529b4aa675a1.jpg?version=0'],
  ['about-factory-hubei.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/1746512899174a22a5cfc17bcd6ecb8ef779ba87d46cf.jpg?version=0'],
  ['about-factory-dg-2.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/174651296445212bac7d7ae4303fed594b9e654e61336.jpg?version=0'],
  ['about-gallery-1.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/1746513063901b1d8594bf233f9d3f613fe3752c62071.jpg?version=0'],
  ['about-gallery-2.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/1746513231286383784d73021bf31eb8678426c486a44.jpg?version=0'],
  ['about-map-china.png', 'https://cdn.yun.sooce.cn/6/1022/png/17464169714132642e094a7339435e976b8ac2b8877de.png?version=1746416973'],
  ['about-factory-italy.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/160431351751801e4fb3c737acafb.jpg?version=0'],
  [
    'about-china-map-inline.jpg',
    ['https://cosmocoat.cn/web/upimages/20170607173413333.jpg', 'http://cosmocoat.cn/web/upimages/20170607173413333.jpg'],
  ],

  ['support-ab-top.png', 'https://cdn.yun.sooce.cn/6/1022/png/1746527416225786029e8fe721b35504ad14220442d54.png?version=0'],
  ['support-waste.png', 'https://cdn.yun.sooce.cn/6/1022/png/17465274240427aed6b545bca2bac50d8dd3d10996fa6.png?version=1746527425'],
  ['support-ab-a.png', 'https://cdn.yun.sooce.cn/6/1022/png/1746527427091d5ab599e6a0e3b4fb4fc1de84a3e1a93.png?version=1746527428'],
  ['support-ab-b.png', 'https://cdn.yun.sooce.cn/6/1022/png/17465274240427aed6b545bca2bac50d8dd3d10996fa6.png?version=1746527425'],
  ['support-divider.png', 'https://cdn.yun.sooce.cn/6/1022/png/17465148820765d518828ff221e17893fa8ebbb65a39e.png?version=1746514883'],
  ['support-pigment-left.png', 'https://cdn.yun.sooce.cn/6/1022/png/17465279598357d1ffe379bb55f209ab9b3b6f1b51053.png?version=0'],
  ['support-pigment-right.png', 'https://cdn.yun.sooce.cn/6/1022/png/1746527964190282cae0a860854216f5fd8019a0259ab.png?version=1746527965'],

  ['prod-1791543.png', 'https://cdn.yun.sooce.cn/6/1022/png/174652699616811b04a00cbee1e2968da9fb90ebe4bbb.png?version=0'],
  ['prod-1791541.png', 'https://cdn.yun.sooce.cn/6/1022/png/17465269432606bc5f0ac2c911c9f172a98a7da50215d.png?version=0'],
  ['prod-1791539.png', 'https://cdn.yun.sooce.cn/6/1022/png/174652686630204cb091f1295adfccffb90f617c38951.png?version=0'],
  ['prod-1791537.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/17465268107519250a7ed67c3cacac3f3dd6daab8226a.jpg?version=1746526812'],
  ['prod-1791533.png', 'https://cdn.yun.sooce.cn/6/1022/png/1746526177131e022abf750b2fdeadbb7372f38edd933.png?version=0'],
  ['prod-1314593.png', 'https://cdn.yun.sooce.cn/6/1022/png/1746434639965051b22d97ed776b34fd27c6ebb61e1bb.png?version=0'],
  ['prod-1314591.png', 'https://cdn.yun.sooce.cn/6/1022/png/1746521412272a855f88ccd6ceb0bafe9288fc5e53069.png?version=0'],
  ['prod-1314589.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/1746435223065bf3ca19821d6434720f6924d25302ae1.jpg?version=0'],
  ['prod-1224565.png', 'https://cdn.yun.sooce.cn/6/1022/png/17464354773131be85fabfe7125861615b4ba151367de.png?version=0'],
  ['prod-1224563.png', 'https://cdn.yun.sooce.cn/6/1022/png/174643559902805a4aa49f52cffc0a88b3127d5113888.png?version=0'],
  ['prod-439905.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/1746524537011a7cd526e2c3f0a3ccd5b43925d3d546b.jpg?version=0'],
  ['prod-439903.png', 'https://cdn.yun.sooce.cn/6/1022/png/174652400253100149ef82b84804f12b936c48fb19ec7.png?version=0'],
  ['prod-367407.png', 'https://cdn.yun.sooce.cn/6/1022/png/174649739453511812bd1ae08a1803fe4ad45fee90921.png?version=0'],
  ['prod-24142.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/1746525061633a835743de680d670c5b0ae2414887ef5.jpg?version=0'],
  ['prod-24518.jpg', 'https://cdn.yun.sooce.cn/6/1022/jpg/17465247600761edd0c7c863a57a853e74712c8598290.jpg?version=0'],
  [
    'prod-367403.png',
    ['https://cosmocoat.cn/web/upimages/prodimg/201810/20181017195434610.png', 'http://cosmocoat.cn/web/upimages/prodimg/201810/20181017195434610.png'],
  ],
]

/**
 * @param {string} dest
 * @param {string[]} urls
 */
async function downloadFirstOk(dest, urls) {
  if (FORCE && fs.existsSync(dest)) {
    try {
      fs.unlinkSync(dest)
    } catch {
      /* ignore */
    }
  }
  if (fs.existsSync(dest)) return 'skip'
  let lastErr = /** @type {Error | null} */ (null)
  for (const url of urls) {
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        headers: BROWSER_HEADERS,
      })
      if (!res.ok) {
        lastErr = new Error(`HTTP ${res.status}`)
        continue
      }
      const buf = Buffer.from(await res.arrayBuffer())
      if (buf.length < 100) {
        lastErr = new Error('response too small')
        continue
      }
      fs.writeFileSync(dest, buf)
      return 'ok'
    } catch (e) {
      lastErr = e instanceof Error ? e : new Error(String(e))
    }
  }
  throw lastErr ?? new Error('download failed')
}

if (FORCE) {
  console.log('Mode: --force (overwrite existing files)\n')
}

let skipCount = 0
for (const [name, spec] of images) {
  const dest = path.join(OUT, name)
  const urls = typeof spec === 'string' ? [spec] : spec
  try {
    const r = await downloadFirstOk(dest, urls)
    if (r === 'skip') {
      skipCount += 1
      console.log(`SKIP  ${name}`)
    } else {
      console.log(`OK    ${name}`)
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error(`FAIL  ${name}: ${msg}`)
  }
}
console.log('Done.')
if (skipCount > 0 && !FORCE) {
  console.log(
    `\n提示: SKIP 表示 public/cosmocoat 里已有该文件，未覆盖。若要重新下载请执行:\n  node cosmocoat/download-images.mjs --force\n`,
  )
}
