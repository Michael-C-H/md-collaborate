/**
 * ZIP 导入服务
 * by AI.Coding
 *
 * 改用 yauzl + decodeStrings: false 拿到原始 fileName 字节，自己用
 * bufferToUtf8（UTF-8 / GBK 兜底）解码。绕过 unzipper 把中文字节
 * 替换为 `?` 的行为。
 *
 * 行为：
 *   - 跳过 macOS 元数据（__MACOSX/）和点开头文件
 *   - 排序：先目录后文件，保证父文件夹先建好
 *   - zip 没有显式目录条目时，按文件路径按需创建（ensureFolder 级联）
 *   - 父目录创建失败 → 该分支下所有子项级联跳过，并在结果里给出原因，
 *     不再回退到导入根（避免散落）
 *   - 非 .md / .markdown 文件被忽略
 *   - 单个文件失败不影响其他（结果数组里 success=false + error 详情）
 */
import { Injectable } from '@nestjs/common'
import yauzl, { type Entry, type ZipFile } from 'yauzl'
import { bufferToUtf8 } from '../common/utils/encoding'
import { NodeService } from '../node/node.service'
import { MarkdownImporter, type ImportItemResult } from './markdown.service'

interface ZipEntry {
  fileName: string
  isDirectory: boolean
  /** 仅文件类型有 */
  content?: Buffer
}

@Injectable()
export class ZipImporter {
  constructor(
    private readonly nodeService: NodeService,
    private readonly markdownImporter: MarkdownImporter,
  ) {}

  async importZip(
    currentUserId: number,
    isAdmin: boolean,
    parentId: number | null,
    buffer: Buffer,
  ): Promise<ImportItemResult[]> {
    const entries = await readZipEntries(buffer)
    const items: ImportItemResult[] = []

    // 路径 → 已创建的文件夹节点 id；空字符串代表导入根
    const folderMap = new Map<string, number | null>()
    folderMap.set('', parentId)
    // 标记创建失败的目录路径，子项级联跳过，避免散落到根
    const failedFolders = new Set<string>()

    // 整理：标准化路径分隔符 + 过滤元数据 + 排序（先目录后文件，路径短优先）
    const normalized = entries
      .map((e) => ({ ...e, fileName: e.fileName.replace(/\\/g, '/') }))
      .filter((e) => {
        if (e.fileName.startsWith('__MACOSX/')) return false
        if (e.fileName.split('/').some((s) => s.startsWith('.') && s !== '')) {
          return false
        }
        return true
      })
      .sort((a, b) => {
        const ta = a.isDirectory ? 0 : 1
        const tb = b.isDirectory ? 0 : 1
        if (ta !== tb) return ta - tb
        return a.fileName.length - b.fileName.length
      })

    // 递归保证 key 路径上的所有目录均已创建。
    //  - 父链上任一目录创建失败 → 整条分支失败（不回退到根）
    //  - 支持 zip 没有显式目录条目（如部分老工具产生的 zip）
    const ensureFolder = async (
      key: string,
    ): Promise<{ ok: true; id: number | null } | { ok: false; error: string }> => {
      if (folderMap.has(key)) return { ok: true, id: folderMap.get(key) ?? null }
      if (failedFolders.has(key)) {
        return { ok: false, error: `父目录 "${key}" 创建失败，已跳过` }
      }
      if (key === '') return { ok: true, id: parentId }

      const segs = key.split('/').filter(Boolean)
      const baseName = segs[segs.length - 1] ?? ''
      const grandKey = segs.slice(0, -1).join('/')

      const grand = await ensureFolder(grandKey)
      if (!grand.ok) {
        failedFolders.add(key)
        return grand
      }

      try {
        const folder = await this.nodeService.create(currentUserId, isAdmin, {
          parentId: grand.id,
          type: 'FOLDER',
          name: baseName.slice(0, 100),
        })
        folderMap.set(key, folder.id)
        items.push({ name: key, success: true, nodeId: folder.id, error: null })
        return { ok: true, id: folder.id }
      } catch (err) {
        const msg = (err as Error).message
        failedFolders.add(key)
        items.push({ name: key, success: false, nodeId: null, error: msg })
        return { ok: false, error: msg }
      }
    }

    for (const entry of normalized) {
      const path = entry.fileName.replace(/\/+$/, '')
      if (!path) continue

      const segments = path.split('/').filter(Boolean)
      const baseName = segments[segments.length - 1] ?? ''
      const parentKey = segments.slice(0, -1).join('/')

      if (entry.isDirectory) {
        // ensureFolder 会自动级联创建祖先；已存在则直接复用，不会重复记录
        await ensureFolder(path)
        continue
      }

      if (!/\.(md|markdown)$/i.test(entry.fileName) || !entry.content) {
        // 其他类型（非 .md 文件）静默跳过
        continue
      }

      const parent = await ensureFolder(parentKey)
      if (!parent.ok) {
        items.push({ name: path, success: false, nodeId: null, error: parent.error })
        continue
      }

      try {
        // 内容也走编码自动识别（UTF-8 / GBK）
        const content = bufferToUtf8(entry.content)
        const item = await this.markdownImporter.importFile(
          currentUserId,
          isAdmin,
          parent.id,
          baseName,
          content,
        )
        // 用 zip 内完整路径作为返回 name，更直观
        items.push({ ...item, name: path })
      } catch (err) {
        items.push({
          name: path,
          success: false,
          nodeId: null,
          error: (err as Error).message,
        })
      }
    }

    return items
  }
}

/**
 * 用 yauzl 解 zip，关键是 `decodeStrings: false` —— 让 entry.fileName 保持
 * 原始 Buffer 字节，由我们用 bufferToUtf8 决定如何解码。
 */
function readZipEntries(buffer: Buffer): Promise<ZipEntry[]> {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(
      buffer,
      { lazyEntries: true, decodeStrings: false },
      (err, zip) => {
        if (err || !zip) {
          reject(err ?? new Error('打开 zip 失败'))
          return
        }
        const list: ZipEntry[] = []
        zip.on('entry', (entry: Entry) => {
          // decodeStrings: false 下 entry.fileName 是 Buffer；类型声明仍标 string，强转一下
          const fileNameBytes = entry.fileName as unknown as Buffer
          const fileName = bufferToUtf8(fileNameBytes)
          // yauzl 对目录条目以 / 结尾
          const isDirectory = fileName.endsWith('/')

          if (isDirectory) {
            list.push({ fileName, isDirectory: true })
            zip.readEntry()
            return
          }

          // 文件：读取内容
          zip.openReadStream(entry, (err2, stream) => {
            if (err2 || !stream) {
              list.push({ fileName, isDirectory: false })
              zip.readEntry()
              return
            }
            const chunks: Buffer[] = []
            stream.on('data', (chunk: Buffer) => chunks.push(chunk))
            stream.on('end', () => {
              list.push({
                fileName,
                isDirectory: false,
                content: Buffer.concat(chunks),
              })
              zip.readEntry()
            })
            stream.on('error', () => {
              // 单文件读失败不阻塞其余 entries
              zip.readEntry()
            })
          })
        })
        zip.on('end', () => resolve(list))
        zip.on('error', (e: Error) => reject(e))
        zip.readEntry()
      },
    )
    // 防止 TypeScript 提示 zip 未使用
    void (null as unknown as ZipFile)
  })
}
