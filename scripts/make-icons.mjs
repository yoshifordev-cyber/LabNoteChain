import { writeFileSync, mkdirSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'
import pngToIco from 'png-to-ico'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'build')
const resourcesDir = join(root, 'resources')
const svgPath = join(outDir, 'icon.svg')
const jpgFallback = join(outDir, 'icon-source.jpg')

mkdirSync(outDir, { recursive: true })
mkdirSync(resourcesDir, { recursive: true })

const source = existsSync(svgPath) ? svgPath : jpgFallback

const master = await sharp(source)
  .resize(1024, 1024, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

await sharp(master).toFile(join(outDir, 'icon.png'))
await sharp(master).resize(512, 512).png().toFile(join(outDir, 'icon-512.png'))
await sharp(master).resize(256, 256).png().toFile(join(resourcesDir, 'icon.png'))

const sizes = [16, 24, 32, 48, 64, 128, 256]
const buffers = []
for (const size of sizes) {
  buffers.push(await sharp(master).resize(size, size).png().toBuffer())
}

const ico = await pngToIco(buffers)
writeFileSync(join(outDir, 'icon.ico'), ico)
writeFileSync(join(resourcesDir, 'icon.ico'), ico)

console.log(`Icons from ${existsSync(svgPath) ? 'icon.svg' : 'icon-source.jpg'}`)
