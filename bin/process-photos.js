import { Client } from 'basic-ftp'
import ExifReader from 'exifreader'
import intoStream from 'into-stream'
import Listr from 'listr'
import { createHash } from 'node:crypto'
import { readFile, writeFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { PassThrough } from 'node:stream'
import prettyBytes from 'pretty-bytes'
import sharp from 'sharp'

const baseUrl = `https://pho.limulus.net`

const presets = [
  { name: 'xl', width: null, format: 'avif' },
  { name: 'xl', width: null, format: 'jpeg' },
  { name: 'lg', width: 3000, format: 'avif' },
  { name: 'lg', width: 3000, format: 'jpeg' },
  { name: 'md', width: 1500, format: 'avif' },
  { name: 'md', width: 1500, format: 'jpeg' },
  { name: 'sm', width: 750, format: 'avif' },
  { name: 'sm', width: 750, format: 'jpeg' },
]

const files = process.argv.slice(2)

const ftp = new Client(60000)
const uploadQueue = new PassThrough({ objectMode: true })

const tasks = new Listr(
  [
    {
      title: 'Process Photos',
      task: () =>
        new Listr([
          ...files.map((file) => ({
            title: basename(file),
            task: () => processFile(file),
          })),
          {
            title: 'Clean Up',
            task: () => {
              uploadQueue.end()
            },
          },
        ]),
    },
    {
      title: 'Upload Files',
      task: () =>
        new Listr([
          {
            title: 'Connect to FTP Server',
            task: async () => {
              await ftp.access({
                host: process.env.PHOTOS_FTP_HOSTNAME,
                user: process.env.PHOTOS_FTP_USERNAME,
                password: process.env.PHOTOS_FTP_PASSWORD,
                secure: true,
              })
            },
          },
          {
            title: 'Upload Files',
            task: async (_, task) => {
              for await (const { id, name, data, file } of uploadQueue) {
                task.output = `${id}/${name}: Uploading...`
                await ftp.ensureDir(id)
                await ftp.uploadFrom(file ?? intoStream(data), name)
                await ftp.cd('..')
                task.output = `${id}/${name}: Complete`
              }
            },
          },
          {
            title: 'Close FTP Connection',
            task: () => {
              ftp.close()
            },
          },
        ]),
    },
  ],
  { concurrent: true }
)

await tasks.run()

async function getHash(fileOrBuffer) {
  const buffer =
    fileOrBuffer instanceof Buffer ? fileOrBuffer : await readFile(fileOrBuffer)
  const hash = createHash('sha256').update(buffer).digest('base64url')
  return hash.slice(0, 8)
}

async function processFile(file) {
  const id = await getHash(file)
  const original = basename(file)

  uploadQueue.write({ id, name: original, file })

  const photo = sharp(file)
  const [meta, { width, height }] = await Promise.all([
    ExifReader.load(file, { expanded: true }),
    photo.metadata(),
  ])

  const json = {
    baseUrl: `${baseUrl}/${id}`,
    original,
    width,
    height,
    aspectRatio: width / height,
    title: meta.xmp.title.description,
    description: meta.xmp.description.description,
    date: meta.xmp.DateCreated.description,
    make: meta.exif.Make?.description,
    camera: meta.exif.Model?.description,
    lens: meta.xmp.Lens?.description ?? meta.exif.LensModel?.description,
    focalLength: meta.exif.FocalLength?.description,
    exposureTime: meta.exif.ExposureTime?.description,
    fNumber: meta.exif.FNumber?.description,
    iso: meta.exif.ISOSpeedRatings?.description,
    flash: meta.exif.Flash?.description,
    exposureMode: meta.exif.ExposureMode?.description,
    whiteBalance: meta.exif.WhiteBalance?.description,
    location: meta.gps
      ? {
          latitude: meta.gps.Latitude,
          longitude: meta.gps.Longitude,
          altitude: meta.gps.Altitude,
        }
      : null,
  }

  const uniqueWidths = [...new Set(presets.map((preset) => preset.width))]
  const resizeStreams = new Map(
    uniqueWidths.map((width) => [
      width,
      photo.clone().resize(width, null, { withoutEnlargement: true }),
    ])
  )

  const uploads = presets.map(({ name, width, format }) => {
    const resultPromise = resizeStreams
      .get(width)
      .clone()
      [format]()
      .toBuffer({ resolveWithObject: true })
    return { name, format, resultPromise }
  })

  const renditions = []

  return new Listr([
    {
      title: 'Render',
      task: () =>
        new Listr(
          uploads.map(({ name, format, resultPromise }) => ({
            title: `${name}.xxxxxxxx.${format}`,
            task: async (_, task) => {
              const {
                data,
                info: { width, height, size },
              } = await resultPromise
              const hash = await getHash(data)
              const file = `${name}.${hash}.${format}`
              task.title = `${file} (${prettyBytes(data.length)})`
              const url = `${baseUrl}/${id}/${file}`
              renditions.push({ name, format, url, file, width, height, size })
              uploadQueue.write({ id, name: file, data })
            },
          })),
          { concurrent: true }
        ),
    },
    {
      title: 'index.json',
      task: async () => {
        json.renditions = renditions
        uploadQueue.write({
          id,
          name: 'index.json',
          data: Buffer.from(JSON.stringify({ ...json, renditions }, null, 2)),
        })
      },
    },
    {
      title: 'Update Photo Database',
      task: async () => {
        const index = JSON.parse(await readFile('./www/_data/photos.json', 'utf8'))
        index[id] = json
        await writeFile('./www/_data/photos.json', JSON.stringify(index, null, 2))
      },
    },
  ])
}
