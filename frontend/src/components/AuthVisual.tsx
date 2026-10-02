import { InsightDocLogo } from "./InsightDocLogo";

export function AuthVisual() {
  return (
    <section className="auth-visual">
      <InsightDocLogo light />

      <div className="visual-copy">
        <span className="eyebrow eyebrow-light">AI DOCUMENT INTELLIGENCE</span>
        <h1>
          Turn documents into <em>grounded insight.</em>
        </h1>
        <p>
          Upload your knowledge. Ask natural questions. Get answers you can
          verify.
        </p>
      </div>

      <div
        className="product-flow"
        role="img"
        aria-label="A Research Brief is processed into context, understood by the Insight Engine, and used to answer a question with a source citation"
      >
        <div className="flow-scene">
          <div className="flow-halo" />
          <span className="flow-path flow-path-one" />
          <span className="flow-path flow-path-two" />
          <span className="flow-path flow-path-three" />
          <span className="flow-path flow-path-four" />

          <div className="flow-document flow-glass">
            <span className="flow-document-icon">PDF</span>
            <div>
              <small>YOUR DOCUMENT</small>
              <strong>Research Brief</strong>
              <span>24 pages</span>
            </div>
            <span className="flow-document-ready" aria-hidden="true">
              ✓
            </span>
          </div>

          <div className="flow-context flow-glass">
            <span className="flow-section-label">01 / CONTEXT</span>
            <strong>Relevant passages</strong>
            <div className="flow-context-section">
              <span>Market outlook</span>
              <i />
              <i />
            </div>
            <div className="flow-context-section">
              <span>Key opportunities</span>
              <i />
              <i />
            </div>
          </div>

          <div className="flow-engine flow-glass">
            <span className="flow-engine-core" aria-hidden="true">
              ✦
            </span>
            <div>
              <small>02 / INTELLIGENCE</small>
              <strong>Insight Engine</strong>
              <span>Understanding document</span>
            </div>
          </div>

          <div className="flow-question flow-glass">
            <span className="flow-question-avatar">YOU</span>
            <div>
              <small>03 / YOUR QUESTION</small>
              <strong>What are the key findings?</strong>
            </div>
          </div>

          <div className="flow-answer flow-glass">
            <span className="flow-answer-mark" aria-hidden="true">
              ✦
            </span>
            <div>
              <small>04 / GROUNDED ANSWER</small>
              <p>
                The report identifies three primary opportunities supported by
                the research.
              </p>
              <span className="flow-citation">
                ▤ Research Brief · Page 12 <i>↗</i>
              </span>
            </div>
          </div>
        </div>
      </div>

      <p className="auth-trust">
        <span className="auth-trust-item">
          <b>✓</b> Private by design
        </span>
        <i />
        <span className="auth-trust-item">
          <b>✓</b> Source-backed answers
        </span>
        <i />
        <span className="auth-trust-item">
          <b>✓</b> Your data stays yours
        </span>
      </p>
    </section>
  );
}
