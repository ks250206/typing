import { useEffect, useState } from 'react'
import {
  readSentencePracticeSettings,
  saveSentencePracticeSettings,
} from '../../infrastructure/persistence/sentencePractice'

export function useSentencePracticeSettings(
  onNotice: (message: string) => void,
) {
  const [config, setConfig] = useState(readSentencePracticeSettings)
  useEffect(() => {
    try {
      saveSentencePracticeSettings(config)
    } catch {
      onNotice(
        '一文練習の設定を保存できません。この画面では引き続き利用できます。',
      )
    }
  }, [config, onNotice])
  return { config, setConfig }
}
