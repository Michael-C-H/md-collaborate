/**
 * 节点路径 / 深度 工具
 * by AI.Coding
 *
 * 物化路径形如 "/3/9/12"，每段是节点 id。
 */
import { Injectable } from '@nestjs/common'

@Injectable()
export class NodePathHelper {
  /** 构造节点 path：parentPath 为 null 表示根级 */
  buildPath(parentPath: string | null, selfId: number): string {
    if (!parentPath) return `/${selfId}`
    return `${parentPath}/${selfId}`
  }

  /** 根 = 0；"/3" = 0；"/3/9" = 1；"/3/9/12" = 2 */
  computeDepth(path: string): number {
    const segs = path.split('/').filter((s) => s.length > 0)
    return Math.max(segs.length - 1, 0)
  }

  /** childPath 是否在 ancestorPath 的子树（含等于自身） */
  isUnder(childPath: string, ancestorPath: string): boolean {
    return childPath === ancestorPath || childPath.startsWith(`${ancestorPath}/`)
  }
}
