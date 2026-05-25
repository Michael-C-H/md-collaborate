<script setup lang="ts">
/**
 * UserAvatar — 全系统统一的用户头像组件
 * by AI.Coding
 *
 * 用法：
 *   <UserAvatar :user-id="1" name="诸葛亮" :size="32" shape="circle" />
 *
 * 文字 / 颜色规则见 @/utils/avatar.ts。
 */
import { computed } from 'vue'
import { pickColor, pickInitials } from '@/utils/avatar'

const props = withDefaults(
  defineProps<{
    /** 稳定标识，用于颜色哈希 */
    userId: number | string
    /** 真实姓名；空时显示 '?' */
    name: string | null | undefined
    /** 像素尺寸（宽 = 高），默认 32 */
    size?: number
    /** 形状，默认圆形 */
    shape?: 'circle' | 'square'
  }>(),
  {
    size: 32,
    shape: 'circle',
  },
)

const text = computed(() => pickInitials(props.name))
const bgColor = computed(() => pickColor(props.userId))
const borderRadius = computed(() => (props.shape === 'circle' ? '50%' : '4px'))
const fontSize = computed(() => `${Math.round(props.size * 0.42)}px`)

const wrapperStyle = computed(() => ({
  width: `${props.size}px`,
  height: `${props.size}px`,
  borderRadius: borderRadius.value,
  backgroundColor: bgColor.value,
  fontSize: fontSize.value,
}))
</script>

<template>
  <div
    class="user-avatar"
    :style="wrapperStyle"
    :title="props.name ?? ''"
    role="img"
    :aria-label="props.name ?? '匿名用户'"
  >
    {{ text }}
  </div>
</template>

<style scoped>
.user-avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 600;
  line-height: 1;
  user-select: none;
  vertical-align: middle;
  letter-spacing: 0;
  flex: 0 0 auto;
}
</style>
