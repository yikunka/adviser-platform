// Run once: node sfsdiamond/download-images.mjs
import https from 'https'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const OUT = path.join(__dirname, '../public/sfsdiamond')

const images = [
  // Logo & brand
  ['logo.png',             'https://static.wixstatic.com/media/57b12c_f0a93444a19f456b9755b997954c31f0~mv2.png'],
  ['logo-text.jpg',        'https://static.wixstatic.com/media/57b12c_83a7ba2c65fc4f84b1a6a793effd8ae4~mv2.jpg'],
  ['facebook.png',         'https://static.wixstatic.com/media/11062b_2381e8a6e7444f4f902e7b649aa3f0ac~mv2.png'],

  // Home hero & highlights
  ['hero-diamond.jpg',     'https://static.wixstatic.com/media/57b12c_4fff93e1c6894890b71f51aaa97f0819f000.jpg'],
  ['diamond-crystal.jpg',  'https://static.wixstatic.com/media/57b12c_24d4bac4b1304b8e930e2e7a36c27ec6~mv2.jpg'],

  // Team photos
  ['team-1.jpg',           'https://static.wixstatic.com/media/57b12c_1c99cf49882b46398767c93be729abd6~mv2.jpg'],
  ['team-2.jpg',           'https://static.wixstatic.com/media/57b12c_b74b44a9336640d9ae284615d9e51d8c~mv2.jpg'],
  ['team-3.jpg',           'https://static.wixstatic.com/media/57b12c_e498f4d2ecf641b28c5cd0c09be06c88~mv2.jpg'],

  // 6-step process
  ['process-1.jpg',        'https://static.wixstatic.com/media/57b12c_f75f8fe84e40404ea028a8812fcb05a4~mv2.jpg'],
  ['process-2.jpg',        'https://static.wixstatic.com/media/57b12c_80cf308951c645a09d1a280d3be9561d~mv2.jpg'],
  ['process-3.jpg',        'https://static.wixstatic.com/media/3c24a9_7658e5d160eb4e62aa2e8725e959d825~mv2.jpg'],
  ['process-4.jpg',        'https://static.wixstatic.com/media/57b12c_4967ec6cc0504880a1ef31f87543305e~mv2.jpg'],
  ['process-5.png',        'https://static.wixstatic.com/media/57b12c_971a55c9c83045a0b88abb128e422687~mv2.png'],
  ['process-6.jpeg',       'https://static.wixstatic.com/media/57b12c_3ff27a6d46844235a8113e91005af7a6~mv2.jpeg'],

  // Memorial Diamonds page
  ['eternity-cut.jpg',     'https://static.wixstatic.com/media/57b12c_4bb3712af0fb4ac6ac1efb26501a673d~mv2.jpg'],
  ['necklace-life.jpg',    'https://static.wixstatic.com/media/57b12c_05a96d1939704f59846bde6d1ac2861f~mv2.jpg'],
  ['ring-classic.jpg',     'https://static.wixstatic.com/media/57b12c_257e32bfabba4b5aa399c535296513bd~mv2.jpg'],
  ['necklace-buddha.jpg',  'https://static.wixstatic.com/media/57b12c_e3f18ff9628c455d90e065c5e2baab7f~mv2.jpg'],
  ['necklace-bagua.jpg',   'https://static.wixstatic.com/media/57b12c_7a254b0a1eb7453b9c8457a1f74b4af1~mv2.jpg'],
  ['necklace-cross.png',   'https://static.wixstatic.com/media/57b12c_44d8a90f38014a69b679a930d9f39216~mv2.png'],
  ['eternity-symbol.jpeg', 'https://static.wixstatic.com/media/3c24a9_dca2dbbb98a94207864b75f4e3164ce9~mv2.jpeg'],
  ['masonry.jpeg',         'https://static.wixstatic.com/media/3c24a9_507b650c74f64d3b94d29d3d0ec3238b~mv2.jpeg'],
  ['eternal-love.png',     'https://static.wixstatic.com/media/3c24a9_912b3ce664ef42e3b8a9abe03cba04b5~mv2.png'],
  ['bond.jpg',             'https://static.wixstatic.com/media/3c24a9_e31a270959aa418ca6bb96074e23bcea~mv2.jpg'],
  ['tribute.jpg',          'https://static.wixstatic.com/media/3c24a9_b15a6eb6ec924ba8bf6519110ef1bf4b~mv2.jpg'],
  ['continuity.jpeg',      'https://static.wixstatic.com/media/3c24a9_37db1307ba384ba88f80255be2a45ffc~mv2.jpeg'],
  ['spec-photo.jpg',       'https://static.wixstatic.com/media/3c24a9_e261fde417af4e0597b9705ecc894cb3~mv2.jpg'],
  ['cert-logo.png',        'https://static.wixstatic.com/media/3c24a9_773c034118e4412e928403e1a58a81f0~mv2.png'],
  ['forever-love.png',     'https://static.wixstatic.com/media/3c24a9_bf45cf5ef2074eb38d08023493b1a4d8~mv2.png'],

  // Technology page
  ['cvd-diagram.jpg',      'https://static.wixstatic.com/media/11062b_d57e5e97bf6543b491330d08b607ff6e~mv2.jpg'],
  ['carbon-source.webp',   'https://static.wixstatic.com/media/3c24a9_94ce9cb0220540c7bca2cf5a58a8b355~mv2.webp'],
  ['diamond-pure.jpg',     'https://static.wixstatic.com/media/3c24a9_c06a5b7b519b46daa687d4f6da4e020a~mv2.jpg'],
  ['chemical.jpg',         'https://static.wixstatic.com/media/3c24a9_2fb41a2158904397b9bf3ffa79955ddd~mv2.jpg'],
  ['cvd-machine.jpeg',     'https://static.wixstatic.com/media/11062b_3161beb19e0d4f918b9649cf1a8666eb~mv2.jpeg'],
  ['extraction.jpg',       'https://static.wixstatic.com/media/57b12c_0ca7809e3e844d059c4b3bed700a4edef000.jpg'],
  ['growth.jpg',           'https://static.wixstatic.com/media/3c24a9_2b408ee1beb34f46a2b12f9f37f3c1eb~mv2.jpg'],
  ['craft-1.jpg',          'https://static.wixstatic.com/media/3c24a9_d2aecaed286b41e8a3e9e25c31b55434~mv2.jpg'],
  ['craft-2.jpg',          'https://static.wixstatic.com/media/3c24a9_35154ef4f1704e66ad67751d90a8750a~mv2.jpg'],
  ['qc-diagram.png',       'https://static.wixstatic.com/media/3c24a9_1b3b92bc1c97454eb5323b21041ef928~mv2.png'],
  ['step-mark.jpg',        'https://static.wixstatic.com/media/57b12c_2b63fa6b10a34b649e7daa574d5441fe~mv2.jpg'],
  ['step-scan.jpg',        'https://static.wixstatic.com/media/57b12c_2d8738d3e4644c68bdf25d9f4e030fd7~mv2.jpg'],
  ['step-design.jpg',      'https://static.wixstatic.com/media/57b12c_a4628bd5f9474d7bb55f678760cdc71f~mv2.jpg'],
  ['step-laser.jpg',       'https://static.wixstatic.com/media/57b12c_8473fed9d2c94cdf8b1fe4ec927cc692~mv2.jpg'],
  ['step-polish.jpg',      'https://static.wixstatic.com/media/57b12c_94dace8fa515463a8aa8bc77f2cbe65e~mv2.jpg'],
  ['step-quality.jpg',     'https://static.wixstatic.com/media/57b12c_7a251e58e4414c8faeaba4cac8b07008~mv2.jpg'],

  // About page
  ['company.jpg',          'https://static.wixstatic.com/media/3c24a9_9faf6f21b7be4137a48b022d832a7f9a~mv2.jpg'],
  ['sfs-logo-alt.png',     'https://static.wixstatic.com/media/57b12c_6f883a7bff7449b7b67c5ffce0643b89~mv2.png'],
  ['sfs-logo-dark.png',    'https://static.wixstatic.com/media/57b12c_bc8632ad177f48a8a740d018097b1830~mv2.png'],
]

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) { resolve('skip'); return }
    const file = fs.createWriteStream(dest)
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        download(res.headers.location, dest).then(resolve).catch(reject)
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', e => { fs.unlink(dest, () => {}); reject(e) })
  })
}

for (const [name, url] of images) {
  const dest = path.join(OUT, name)
  try {
    const r = await download(url, dest)
    console.log(r === 'skip' ? `SKIP  ${name}` : `OK    ${name}`)
  } catch (e) {
    console.error(`FAIL  ${name}: ${e.message}`)
  }
}
console.log('Done.')
