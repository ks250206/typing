export function LanguageSwitch({
  value,
  onChange,
}: {
  value: 'ja' | 'en'
  onChange: (language: 'ja' | 'en') => void
}) {
  return (
    <div
      className="language-switch filters"
      role="group"
      aria-label="文章の言語"
    >
      {(
        [
          ['ja', '日本語'],
          ['en', 'English'],
        ] as const
      ).map(([language, label]) => (
        <button
          key={language}
          aria-pressed={value === language}
          className={value === language ? 'selected' : ''}
          onClick={() => onChange(language)}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
