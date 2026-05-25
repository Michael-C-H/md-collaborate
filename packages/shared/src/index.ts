/**
 * 共享包入口 — 前后端共用的 Zod schema 与 TypeScript 类型
 * by AI.Coding
 */

// 通用类型
export * from './types/api-result.js'
export * from './types/role.js'

// 业务 schemas（按批次逐步填充）
export * from './schemas/auth.js'
export * from './schemas/user.js'
export * from './schemas/node.js'
export * from './schemas/permission.js'
export * from './schemas/snapshot.js'
export * from './schemas/image.js'
export * from './schemas/imexport.js'
export * from './schemas/trash.js'
export * from './schemas/audit.js'
