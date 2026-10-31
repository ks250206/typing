import { useEffect, useLayoutEffect, useState } from 'react'
import {
  readSettings,
  saveSettings,
} from '../../infrastructure/persistence/storage'

export function useSettings(setNotice: (message: string) => void) {
  const [settings, setSettings] = useState(readSettings)
  useLayoutEffect(() => {
    const root = document.documentElement
    root.toggleAttribute('data-display-enlarged', settings.displayScale > 100)
    root.style.zoom = String(settings.displayScale / 100)
    root.style.setProperty(
      '--display-zoom',
      String(settings.displayScale / 100),
    )
    window.dispatchEvent(new Event('resize'))
    return () => {
      root.removeAttribute('data-display-enlarged')
      root.style.removeProperty('zoom')
      root.style.removeProperty('--display-zoom')
    }
  }, [settings.displayScale])
  useEffect(() => {
    // Report a failure from the external storage system, once per settings change.
    if (!saveSettings(settings))
      // oxlint-disable-next-line react/set-state-in-effect
      setNotice('設定を保存できません。この画面では引き続き使えます。')
  }, [settings, setNotice])
  return { settings, setSettings }
}
