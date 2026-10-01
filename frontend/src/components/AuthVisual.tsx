import { InsightDocLogo } from "./InsightDocLogo";

export function AuthVisual() {
  return (
    <section className="auth-visual">
      <InsightDocLogo light />

      <div className="visual-copy">
        <span className="eyebrow eyebrow-light">
          AI DOCUMENT INTELLIGENCE
        </span>

        <h1>
          Turn documents into <em>grounded insight.</em>
        </h1>

        <p>
          Upload your knowledge. Ask natural questions.
          Get answers you can verify.
        </p>
      </div>

      <div
        className="cinematic-demo"
        aria-label="InsightDoc document intelligence animation"
      >
        <div className="laptop-glow" />

        <div className="laptop-scene">
          <div className="laptop-lid">
            <div className="device">
              <div className="device-bar">
                <i />
                <i />
                <i />

                <span>InsightDoc workspace</span>

                <b>
                  <span className="privacy-dot" />
                  Private
                </b>
              </div>

              <div className="device-screen">
                <div className="screen-boot">
                  <div className="boot-logo">
                    <span className="boot-document">
                      <span />
                    </span>
                  </div>

                  <strong>InsightDoc</strong>
                  <small>Document intelligence</small>
                </div>

                <div className="mini-sidebar">
                  <span className="mini-logo">I</span>
                  <i />
                  <i />
                  <i />
                </div>

                <div className="demo-canvas">
                  <div className="demo-heading">
                    <small>DOCUMENT ANALYSIS</small>
                    <strong>Research workspace</strong>
                  </div>

                  <div className="document-entry">
                    <span className="document-flight-line" />

                    <div className="doc-card">
                      <span className="pdf-badge">PDF</span>

                      <div>
                        <b>Research Brief</b>
                        <small>24 pages</small>
                      </div>

                      <span className="doc-check">&#10003;</span>
                    </div>
                  </div>

                  <div className="chunk-stack">
                    <span />
                    <span />
                    <span />

                    <small>Extracting context</small>
                  </div>

                  <div className="processing-status">
                    <span className="processing-orb" />
                    <div>
                      <small>INSIGHT ENGINE</small>
                      <b>Understanding document</b>
                    </div>
                  </div>

                  <div className="question-card">
                    <small>QUESTION</small>
                    <b>What are the key findings?</b>
                  </div>

                  <div className="answer-card">
                    <span className="spark">&#10022;</span>

                    <div>
                      <small>GROUNDED ANSWER</small>

                      <p>
                        The report identifies three primary opportunities
                        supported by the research.
                      </p>

                      <label>
                        Research Brief &middot; Page 12
                      </label>
                    </div>
                  </div>

                  <div className="insight-path">
                    <span />
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="laptop-deck">
            <span className="keyboard-glow" />
            <span className="trackpad" />
          </div>
        </div>

        <div className="stage-label stage-one">
          <b>01</b>
          <span>Extract</span>
        </div>

        <div className="stage-label stage-two">
          <b>02</b>
          <span>Understand</span>
        </div>

        <div className="stage-label stage-three">
          <b>03</b>
          <span>Ground</span>
        </div>

        <div className="stage-label stage-four">
          <b>04</b>
          <span>Answer</span>
        </div>
      </div>

      <p className="auth-trust">
        <span>&#10003;</span>
        Private by design
        <i />
        <span>&#10003;</span>
        Source-backed answers
        <i />
        <span>&#10003;</span>
        Your data stays yours
      </p>
    </section>
  );
}
