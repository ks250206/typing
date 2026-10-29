import { useEffect, useState } from 'react'
import {
  readSettings,
  saveSettings,
} from '../../infrastructure/persistence/storage'

export function useSettings(setNotice: (message: string) => void) {
  const [settings, setSettings] = useState(readSettings)
  useEffect(() => {
    // Report a failure from the external storage system, once per settings change.
    if (!saveSettings(settings))
      // oxlint-disable-next-line react/set-state-in-effect
      setNotice('設定を保存できません。この画面では引き続き使えます。')
  }, [settings, setNotice])
  return { settings, setSettings }
}
