/**
 * 文档/文件夹相关共享 schema
 * by AI.Coding
 */
import { z } from 'zod'
import { NodeTypeSchema } from '../types/role.js'

/** 节点命名规则：1~100 字符，禁止 / \ : * ? " < > | */
const NODE_NAME_RE = /^[^/\\:*?"<>|]+$/
export const NodeNameSchema = z
  .string()
  .min(1, '名称不能为空')
  .max(100, '名称最多 100 字符')
  .refine((s) => s.trim().length > 0, { message: '名称不能为空白' })
  .refine((s) => NODE_NAME_RE.test(s), {
    message: '名称不能包含 / \\ : * ? " < > | 等字符',
  })

/** 创建节点请求 */
export const CreateNodeSchema = z.object({
  parentId: z.number().int().nullable(),
  type: NodeTypeSchema,
  name: NodeNameSchema,
})
export type CreateNodeDto = z.infer<typeof CreateNodeSchema>

/** 更新（重命名 / 移动）请求 */
export const UpdateNodeSchema = z
  .object({
    name: NodeNameSchema.optional(),
    parentId: z.number().int().nullable().optional(),
  })
  .refine((v) => v.name !== undefined || v.parentId !== undefined, {
    message: '请至少提供一个变更字段',
  })
export type UpdateNodeDto = z.infer<typeof UpdateNodeSchema>

/** 节点视图（不含 path / yjs_state 等内部字段） */
export const NodeVOSchema = z.object({
  id: z.number().int(),
  parentId: z.number().int().nullable(),
  type: NodeTypeSchema,
  name: z.string(),
  depth: z.number().int(),
  creatorId: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})
export type NodeVO = z.infer<typeof NodeVOSchema>

/** 树形节点（包含 children 嵌套） */
export interface NodeTreeVO extends NodeVO {
  children: NodeTreeVO[]
}

/** 三树响应（我的文档 + 共享给我 + 他人文档） */
export interface TreesResponse {
  myTree: NodeTreeVO[]
  sharedTree: NodeTreeVO[]
  othersTree: NodeTreeVO[]
}

/** 文档当前内容（current_content 镜像） */
export const DocContentSchema = z.object({
  markdown: z.string().nullable(),
  updatedAt: z.string().nullable(),
})
export type DocContent = z.infer<typeof DocContentSchema>
