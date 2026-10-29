import { ArrowRight } from 'lucide-react'
import { RubyText } from '../../shared/typing/RubyText'
import type { PracticeSession } from './usePracticeSession'

export function PracticePreview({
  session,
}: {
  session: Pick<
    PracticeSession,
    | 'passage'
    | 'sentences'
    | 'seed'
    | 'typewell'
    | 'etyping'
    | 'rtc'
    | 'articles'
    | 'limit'
    | 'previewParagraphs'
    | 'paragraphSegments'
    | 'startPreview'
  >
}) {
  const {
    passage,
    sentences,
    seed,
    typewell,
    etyping,
    rtc,
    articles,
    limit,
    previewParagraphs,
    paragraphSegments,
    startPreview,
  } = session
  return (
    <section className="passage-preview" key="preview">
      <div className="mission-face-heading">
        <span className="eyebrow">MISSION BRIEFING</span>
        <h2>{passage.title}</h2>
        <p>
          {passage.continuous
            ? `全文1問 · ${passage.paragraphs[0].text.length}文字 · 途中の切り替えなし`
            : typewell
              ? `${limit}打分の単語列 / シード ${seed}`
              : articles
                ? `全14条（全項）/ シード ${seed}`
                : etyping || rtc
                  ? `15問 / シード ${seed}`
                  : `${sentences.length} 文 / ${passage.paragraphs.length} 段落`}
        </p>
      </div>
      <div id="passage-full-text">
        <ol>
          {paragraphSegments.map((segments, index) => (
            <li key={index}>
              {previewParagraphs[index]?.label && (
                <h3>{previewParagraphs[index].label}</h3>
              )}
              {previewParagraphs[index]?.note && (
                <small>{previewParagraphs[index].note}</small>
              )}
              <p>
                <RubyText segments={segments} />
              </p>
            </li>
          ))}
        </ol>
        <button
          className="primary-button"
          onClick={() => {
            startPreview()
          }}
        >
          この文章でスタート <ArrowRight size={16} />
        </button>
      </div>
    </section>
  )
}
