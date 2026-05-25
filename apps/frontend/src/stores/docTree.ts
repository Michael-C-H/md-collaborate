/**
 * 文档树 Pinia store
 * by AI.Coding
 *
 * 管理三棵树：
 *   - myTree：我创建的文档树
 *   - sharedTree：别人分享给我的文档树
 *   - othersTree：管理员专属，其他人的文档树
 */
import { defineStore } from 'pinia'
import { ref } from 'vue'
import type { CreateNodeDto, NodeTreeVO, NodeVO, UpdateNodeDto } from '@app/shared'
import { nodeApi } from '@/api/node.api'

export const useDocTreeStore = defineStore('docTree', () => {
  const myTree = ref<NodeTreeVO[]>([])
  const sharedTree = ref<NodeTreeVO[]>([])
  const othersTree = ref<NodeTreeVO[]>([])
  const loading = ref(false)
  /** 当前选中的节点 id */
  const activeId = ref<number | null>(null)

  async function refresh(): Promise<void> {
    loading.value = true
    try {
      const res = await nodeApi.trees()
      if (res.code === 0 && res.data) {
        myTree.value = Array.isArray(res.data.myTree) ? res.data.myTree : []
        sharedTree.value = Array.isArray(res.data.sharedTree) ? res.data.sharedTree : []
        othersTree.value = Array.isArray(res.data.othersTree) ? res.data.othersTree : []
      } else {
        myTree.value = []
        sharedTree.value = []
        othersTree.value = []
      }
    } finally {
      loading.value = false
    }
  }

  async function create(input: CreateNodeDto): Promise<NodeVO | null> {
    const res = await nodeApi.create(input)
    if (res.code === 0) {
      await refresh()
      return res.data
    }
    throw new Error(res.message)
  }

  async function update(id: number, patch: UpdateNodeDto): Promise<NodeVO | null> {
    const res = await nodeApi.update(id, patch)
    if (res.code === 0) {
      await refresh()
      return res.data
    }
    throw new Error(res.message)
  }

  async function remove(id: number): Promise<void> {
    const res = await nodeApi.remove(id)
    if (res.code === 0) {
      await refresh()
      if (activeId.value === id) activeId.value = null
      return
    }
    throw new Error(res.message)
  }

  function setActive(id: number | null): void {
    activeId.value = id
  }

  return { myTree, sharedTree, othersTree, loading, activeId, refresh, create, update, remove, setActive }
})
