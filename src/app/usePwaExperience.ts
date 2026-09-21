import { useSyncExternalStore } from 'react'
import { getPwaExperienceValue, subscribePwaExperience } from './pwaExperienceContext'

export function usePwaExperience() {
  return useSyncExternalStore(subscribePwaExperience, getPwaExperienceValue, getPwaExperienceValue)
}
