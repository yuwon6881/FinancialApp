import type { RecurringPayment, Transaction, WishlistItem } from '../../types'
import type { WireRecurringPayment, WireTransaction, WireWishlistItem } from '../apiTypes'

const OBFUSCATION_KEY = 'FinancialAppObfuscationKey'

export function deobfuscateAmount(obfuscated: string | number | undefined | null): number {
  if (obfuscated === undefined || obfuscated === null) return 0
  if (typeof obfuscated === 'number') return obfuscated
  try {
    const binaryString = atob(obfuscated)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i) ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    }
    return parseFloat(new TextDecoder().decode(bytes))
  } catch (error) {
    console.error('Failed to deobfuscate value:', obfuscated, error)
    return 0
  }
}

export function obfuscateAmount(value: number | string): string {
  const input = typeof value === 'number' ? value.toFixed(2) : parseFloat(value).toFixed(2)
  const bytes = new TextEncoder().encode(input)
  let binaryString = ''
  for (let i = 0; i < bytes.length; i++) {
    const xored = bytes[i] ^ OBFUSCATION_KEY.charCodeAt(i % OBFUSCATION_KEY.length)
    binaryString += String.fromCharCode(xored)
  }
  return btoa(binaryString)
}

export function deobfuscateTransaction(transaction: WireTransaction): Transaction {
  return { ...transaction, amount: deobfuscateAmount(transaction.amount) }
}

export function deobfuscateRecurringPayment(payment: WireRecurringPayment): RecurringPayment {
  return { ...payment, amount: deobfuscateAmount(payment.amount) }
}

export function deobfuscateWishlistItem(item: WireWishlistItem): WishlistItem {
  return { ...item, price: deobfuscateAmount(item.price) }
}
