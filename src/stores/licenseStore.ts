import { create } from 'zustand'

export type LicenseStatus = 'trial' | 'active' | 'expired' | 'lifetime'

interface LicenseState {
  status: LicenseStatus
  trialDaysLeft: number | null
  expiryDate: string | null
  deviceId: string
  setStatus: (status: LicenseStatus) => void
  setTrialDaysLeft: (days: number | null) => void
  setExpiryDate: (date: string | null) => void
  initDeviceId: () => string
}

function generateDeviceId(): string {
  const array = new Uint8Array(4)
  crypto.getRandomValues(array)
  return Array.from(array).map(b => b.toString(16).toUpperCase().padStart(2, '0')).join('')
}

export const useLicenseStore = create<LicenseState>((set) => ({
  status: 'trial',
  trialDaysLeft: 14,
  expiryDate: null,
  deviceId: '',

  initDeviceId: () => {
    let deviceId = localStorage.getItem('m2player_device_id')
    if (!deviceId) {
      deviceId = generateDeviceId()
      localStorage.setItem('m2player_device_id', deviceId)
    }
    set({ deviceId })
    return deviceId
  },

  setStatus: (status) => set({ status }),
  setTrialDaysLeft: (days) => set({ trialDaysLeft: days }),
  setExpiryDate: (date) => set({ expiryDate: date }),
}))

export function getDeviceId(): string {
  const stored = localStorage.getItem('m2player_device_id')
  if (stored) return stored
  const id = generateDeviceId()
  localStorage.setItem('m2player_device_id', id)
  return id
}