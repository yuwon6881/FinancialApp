import { useCallback, useRef, useState } from 'react'
import type { AiInvocationContext } from '../lib/api/ai'

export interface AiInvocationRequest {
  nonce: number
  prompt: string
  context: AiInvocationContext
  clientTurnId?: string
}

export function useAiEntryPoint() {
  const [invocation, setInvocation] = useState<AiInvocationRequest | null>(null)
  const nonceRef = useRef(0)

  const launch = useCallback((context: AiInvocationContext, prompt: string) => {
    nonceRef.current += 1
    setInvocation({ nonce: nonceRef.current, context, prompt })
  }, [])

  const consume = useCallback(() => setInvocation(null), [])

  return { invocation, launch, consume }
}