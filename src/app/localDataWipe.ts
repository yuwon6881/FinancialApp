export interface LocalDataWipeCounts {
  unsyncedChangeCount: number
  draftCount: number
  scanUploadCount: number | null
  hasPendingLocalChanges: boolean
}

export function describeLocalDataWipe(counts: LocalDataWipeCounts): string {
  const atStake = [
    counts.unsyncedChangeCount > 0
      ? `${counts.unsyncedChangeCount} ${counts.unsyncedChangeCount === 1 ? 'change has' : 'changes have'} not synced yet`
      : null,
    counts.draftCount > 0
      ? `${counts.draftCount} ${counts.draftCount === 1 ? 'draft is' : 'drafts are'} saved only on this device`
      : null,
    counts.scanUploadCount === null
      ? 'the number of saved scan images could not be checked'
      : counts.scanUploadCount > 0
        ? `${counts.scanUploadCount} saved scan image${counts.scanUploadCount === 1 ? '' : 's'} are waiting to upload`
        : null,
  ].filter((item): item is string => item !== null)

  if (atStake.length > 0 || counts.hasPendingLocalChanges) {
    const detail = atStake.length > 0 ? atStake.join(' and ') : 'Some local changes or files are saved only on this device'
    return `${detail}. Clearing removes them permanently.`
  }
  return 'This removes saved copies of your data from this device. Your account is unaffected.'
}
