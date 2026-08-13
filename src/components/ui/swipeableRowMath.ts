export function resolveSwipeTarget({
  currentX,
  actionsWidth,
  velocityX,
  velocityThreshold = 200,
}: {
  currentX: number
  actionsWidth: number
  velocityX: number
  velocityThreshold?: number
}): number {
  const boundedX = Math.max(-actionsWidth, Math.min(0, currentX))
  if (velocityX <= -velocityThreshold) return -actionsWidth
  if (velocityX >= velocityThreshold) return 0
  return boundedX < -actionsWidth / 2 ? -actionsWidth : 0
}
