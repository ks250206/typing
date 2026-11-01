import type { Dispatch, SetStateAction } from 'react'
import { cpuPresets } from '../../domain/battle/cpuMatch'
import type { CpuConfig } from '../../domain/battle/cpuMatch'
import {
  isTypewellBattle,
  maxCpuWordsPerPrompt,
  normalizeCpuWordsPerPrompt,
} from '../../domain/battle/cpuPromptSettings'
import { battleSets } from '../../domain/content/battleSets'
import { isEnglish } from '../../domain/content/english'
import { freshSeed } from '../../domain/content/typewell'
import { layoutLabels } from '../../domain/typing/engine'
import type { Layout } from '../../domain/typing/engine'
import { NumberInput } from '../../shared/ui/NumberInput'
import { Select } from '../../shared/ui/Select'

/** Pre-match CPU settings; the battle owns the values and their persistence. */
export function CpuConfigForm({
  config,
  setConfig,
  layout,
  setLayout,
  setId,
  onSetChange,
  wordsPerPrompt,
  onWordsPerPromptCommit,
  seed,
  setSeed,
  fixed,
  setFixed,
}: {
  config: CpuConfig
  setConfig: Dispatch<SetStateAction<CpuConfig>>
  layout: Layout
  setLayout: (layout: Layout) => void
  setId: string
  onSetChange: (id: string) => void
  wordsPerPrompt: number
  onWordsPerPromptCommit: (value: number) => void
  seed: string
  setSeed: (seed: string) => void
  fixed: boolean
  setFixed: (fixed: boolean) => void
}) {
  const preset =
    cpuPresets.find(
      (p) =>
        p.kpm === config.kpm &&
        p.reactionMs === config.reactionMs &&
        p.curve === config.curve,
    )?.name ?? 'カスタム'
  return (
    <>
      <fieldset className="cpu-config">
        <label>
          CPUプリセット
          <Select
            label="CPUプリセット"
            value={preset}
            options={[
              ...cpuPresets.map((p) => ({
                value: p.name,
                label: p.name,
              })),
              { value: 'カスタム', label: 'カスタム', disabled: true },
            ]}
            onChange={(value) => {
              const p = cpuPresets.find((p) => p.name === value)
              if (p) setConfig({ ...p })
            }}
          />
        </label>
        <label>
          CPU速度 (KPM)
          <NumberInput
            aria-label="CPU速度 (KPM)"
            min={35}
            max={1800}
            value={config.kpm}
            onChange={(kpm) => setConfig((c) => ({ ...c, kpm }))}
          />
        </label>
        <label>
          反応時間 (ms)
          <NumberInput
            aria-label="CPU反応時間 (ms)"
            min={100}
            max={1500}
            step={1}
            value={config.reactionMs}
            onChange={(reactionMs) => setConfig((c) => ({ ...c, reactionMs }))}
          />
        </label>
        <label>
          打ち方
          <Select
            label="CPUの打ち方"
            value={config.curve}
            options={[
              { value: 'constant', label: '一定速度' },
              { value: 'ease-in', label: 'イーズイン（徐々に加速）' },
            ]}
            onChange={(value) =>
              setConfig((c) => ({
                ...c,
                curve: value as CpuConfig['curve'],
              }))
            }
          />
        </label>
        <label>
          入力方式
          <Select
            label="対戦の入力方式"
            value={layout}
            options={Object.entries(layoutLabels)
              .filter(([value]) => value !== 'kana' || !isEnglish(setId))
              .map(([value, label]) => ({
                value,
                label,
              }))}
            onChange={(value) => setLayout(value as Layout)}
          />
        </label>
        <label className="battle-set-control">
          文章セット
          <Select
            label="対戦の文章セット"
            value={setId}
            options={battleSets.map((s) => ({
              value: s.id,
              label: `${s.language === 'en' ? 'English · ' : ''}${s.title}`,
            }))}
            onChange={onSetChange}
          />
        </label>
        {isTypewellBattle(setId) && (
          <label>
            1問の単語数
            <input
              key={wordsPerPrompt}
              aria-label="1問の単語数"
              type="number"
              min={1}
              max={maxCpuWordsPerPrompt}
              step={1}
              defaultValue={wordsPerPrompt}
              onBlur={(event) => {
                const value = normalizeCpuWordsPerPrompt(
                  event.target.value === '' ? NaN : Number(event.target.value),
                )
                event.target.value = String(value)
                onWordsPerPromptCommit(value)
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
              }}
            />
          </label>
        )}
        <div className="battle-seed-controls">
          <label className="battle-seed-label" htmlFor="cpu-match-seed">
            対戦シード
          </label>
          <input
            id="cpu-match-seed"
            aria-label="対戦シード"
            maxLength={64}
            value={seed}
            onChange={(event) => setSeed(event.target.value)}
          />
          <label className="battle-fixed-toggle">
            <span>固定</span>
            <input
              type="checkbox"
              aria-label="対戦シードを固定する"
              checked={fixed}
              onChange={(event) => setFixed(event.target.checked)}
            />
          </label>
          <button
            className="battle-seed-refresh"
            type="button"
            disabled={fixed}
            onClick={() => setSeed(freshSeed())}
          >
            更新
          </button>
        </div>
      </fieldset>
      <p className="cpu-config-note">
        反応時間は出題から初打鍵までの待ち時間。KPMは加速後の定常速度です。プリセットは人の反応をイメージしたゲーム内設定です。
      </p>
    </>
  )
}
