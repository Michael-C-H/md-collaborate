/**
 * 字节流解码为 UTF-8 字符串（带 BOM 识别与 GBK 兜底）
 * by AI.Coding
 *
 * 处理顺序：
 *   1. UTF-8 BOM（EF BB BF）→ 去掉 BOM 再按 UTF-8 解码
 *   2. UTF-16 LE BOM（FF FE）→ 按 utf-16le 解码
 *   3. UTF-16 BE BOM（FE FF）→ 按 utf-16be 解码
 *   4. 直接按 UTF-8 解；解出现 U+FFFD 替换字符 → 兜底按 GBK 解
 *      （Windows 记事本默认中文 GBK / GB18030，简单兜底覆盖 90% 场景）
 */
import iconv from 'iconv-lite'

const UTF8_BOM = [0xef, 0xbb, 0xbf]
const UTF16_LE_BOM = [0xff, 0xfe]
const UTF16_BE_BOM = [0xfe, 0xff]
const REPLACEMENT_CHAR = '�'

export function bufferToUtf8(buffer: Buffer): string {
  if (startsWith(buffer, UTF8_BOM)) {
    return buffer.slice(3).toString('utf-8')
  }
  if (startsWith(buffer, UTF16_LE_BOM)) {
    return iconv.decode(buffer.slice(2), 'utf-16le')
  }
  if (startsWith(buffer, UTF16_BE_BOM)) {
    return iconv.decode(buffer.slice(2), 'utf-16be')
  }
  const asUtf8 = buffer.toString('utf-8')
  // UTF-8 解码失败时会出现 U+FFFD（替换字符）；进入 GBK 兜底
  if (asUtf8.includes(REPLACEMENT_CHAR)) {
    return iconv.decode(buffer, 'gbk')
  }
  return asUtf8
}

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  if (buffer.length < bytes.length) return false
  for (let i = 0; i < bytes.length; i += 1) {
    if (buffer[i] !== bytes[i]) return false
  }
  return true
}

/**
 * 修复 Express + multer 的 originalname / formdata 中文乱码：
 *
 * Express 默认按 latin1 解析 multipart Content-Disposition 中的 filename，
 * 但浏览器实际发送的是 UTF-8 字节序列，因此拿到的字符串"看起来像 ç®­ç¨..."
 * 这种 mojibake。重新当 UTF-8 解一次即可恢复原中文。
 *
 * 副作用：如果输入本身就是合法 ASCII，重新解码后等同原值；不会破坏英文文件名。
 */
export function fixMulterFilename(name: string): string {
  if (!name) return name
  try {
    return Buffer.from(name, 'latin1').toString('utf-8')
  } catch {
    return name
  }
}

/**
 * 修复 unzipper 解出来的 zip 内中文文件名 mojibake：
 *
 * Windows 自带"发送到压缩文件"用 GBK 编码 zip 内文件名，且不在 zip 头标记
 * UTF-8 flag。unzipper 默认按 cp437（DOS 编码）解码 → 中文字节被映射成
 * box-drawing / 拉丁补充字符（如 "宀蜂尽" 风格）。
 *
 * 修复思路：
 *   1. ASCII 文件名直接返回（"abc.md"）
 *   2. 把 mojibake 字符串按 cp437 反编码回原始字节序列
 *   3. 用 bufferToUtf8 重新解码（UTF-8 / GBK 兜底）
 *   4. 修复结果含替换字符（�）→ 视为修复失败，保持原值
 */
export function fixZipPath(path: string): string {
  if (!path) return path
  // 全 ASCII 不需要修
  let onlyAscii = true
  for (let i = 0; i < path.length; i += 1) {
    if (path.charCodeAt(i) > 127) {
      onlyAscii = false
      break
    }
  }
  if (onlyAscii) return path

  try {
    const bytes = iconv.encode(path, 'cp437')
    const fixed = bufferToUtf8(bytes)
    if (fixed && !fixed.includes(REPLACEMENT_CHAR) && fixed !== path) {
      return fixed
    }
  } catch {
    // 编码失败 → 原样返回
  }
  return path
}
