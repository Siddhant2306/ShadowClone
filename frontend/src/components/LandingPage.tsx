import { useEffect, useState, type CSSProperties } from "react";

type AuthMode = "register" | "login";

type LandingPageProps = {
  onAuth: (mode: AuthMode) => void;
};

const waveform = [
  10, 15, 9, 19, 13, 30, 18, 38, 21, 48, 28, 62, 33, 47, 25, 68, 34, 54, 27, 44,
  21, 59, 31, 40, 19, 50, 25, 34, 16, 43, 20, 29, 13, 36, 16, 24, 11, 18, 9,
];

export default function LandingPage({ onAuth }: LandingPageProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const root = document.documentElement;
    root.classList.add("reveal-enabled");
    const elements = Array.from(
      document.querySelectorAll<HTMLElement>(".reveal"),
    );
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14 },
    );
    elements.forEach((element) => observer.observe(element));

    return () => {
      observer.disconnect();
      root.classList.remove("reveal-enabled");
    };
  }, []);

  function closeMenu() {
    setMenuOpen(false);
  }

  return (
    <div className="landing-page">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <nav className="site-nav" aria-label="Main navigation">
        <a
          className="wordmark"
          href="#top"
          aria-label="Shadow Clone home"
          onClick={closeMenu}
        >
          <span className="wordmark-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>shadow clone</span>
        </a>
        <button
          className="mobile-menu-toggle"
          type="button"
          aria-expanded={menuOpen}
          aria-controls="primary-links"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          onClick={() => setMenuOpen((open) => !open)}
        >
          <span />
          <span />
        </button>
        <div
          className={`site-nav-links${menuOpen ? " is-open" : ""}`}
          id="primary-links"
        >
          <a href="#product" onClick={closeMenu}>
            Product
          </a>
          <a href="#how-it-works" onClick={closeMenu}>
            How it works
          </a>
          <a href="#technology" onClick={closeMenu}>
            Technology
          </a>
          <button
            className="nav-sign-in"
            onClick={() => {
              closeMenu();
              onAuth("login");
            }}
          >
            Sign in
          </button>
        </div>
        <button
          className="button button-light nav-cta"
          onClick={() => onAuth("register")}
        >
          Create your clone <span aria-hidden="true">↗</span>
        </button>
      </nav>

      <main id="main-content">
        <section className="hero-section" id="top">
          <div className="hero-copy reveal">
            <p className="section-kicker">
              <span className="status-dot" />A voice that carries you forward
            </p>
            <h1>
              Your presence.
              <br />
              <span>Beyond your presence.</span>
            </h1>
            <p className="hero-description">
              An AI that learns how you communicate, understands your context,
              and speaks in your voice when you can’t be there.
            </p>
            <div className="hero-actions">
              <button
                className="button button-light button-large"
                onClick={() => onAuth("register")}
              >
                Create your Shadow <span aria-hidden="true">↗</span>
              </button>
              <a className="text-action" href="#experience">
                Explore the experience <span aria-hidden="true">↓</span>
              </a>
            </div>
            <p className="hero-footnote">
              Built around your voice. Governed by your consent.
            </p>
          </div>

          <div
            className="identity-art reveal"
            role="img"
            aria-label="Abstract visualization of a voice identity connecting you and your Shadow"
          >
            <div className="art-coordinate art-coordinate-top">
              IDENTITY SIGNAL / 01
            </div>
            <div className="identity-orbit orbit-outer" />
            <div className="identity-orbit orbit-middle" />
            <div className="identity-orbit orbit-inner" />
            <div className="identity-core">
              <svg viewBox="0 0 220 220" aria-hidden="true">
                <defs>
                  <linearGradient id="core-line" x1="0" x2="1">
                    <stop offset="0" stopColor="#f1efe9" stopOpacity=".35" />
                    <stop offset=".5" stopColor="#f1efe9" stopOpacity=".95" />
                    <stop offset="1" stopColor="#b6a3e6" stopOpacity=".45" />
                  </linearGradient>
                </defs>
                <path
                  d="M22 111h24l10-25 16 53 18-88 20 112 18-68 14 35 13-21 11 2h34"
                  fill="none"
                  stroke="url(#core-line)"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                />
                <path
                  d="M32 126h22m112-31h22"
                  fill="none"
                  stroke="#b6a3e6"
                  strokeOpacity=".4"
                  strokeWidth="1"
                />
              </svg>
              <span className="core-caption">VOICE / PRESENCE</span>
            </div>
            <div className="art-node node-owner">
              <span className="node-point" />
              <span>YOU</span>
            </div>
            <div className="art-node node-shadow">
              <span className="node-point" />
              <span>YOUR SHADOW</span>
            </div>
            <div className="art-coordinate art-coordinate-bottom">
              <span>VOICE</span>
              <span>CONTEXT</span>
              <span>CONSENT</span>
            </div>
            <span className="art-index">SC—01</span>
          </div>
          <a className="hero-scroll" href="#product">
            <span>Scroll to discover</span>
            <span className="scroll-line" />
          </a>
        </section>

        <section className="concept-section section-frame" id="product">
          <div className="concept-index reveal">
            <span className="section-number">01</span>
            <span className="vertical-label">A DIFFERENT KIND OF PRESENCE</span>
          </div>
          <div className="concept-copy reveal">
            <p className="section-kicker">Not another assistant</p>
            <h2>
              What if you
              <br />
              didn’t have to be
              <br />
              <em>everywhere?</em>
            </h2>
            <div className="concept-detail">
              <span className="concept-rule" />
              <p>
                Some conversations can’t wait for a free afternoon. Shadow Clone
                carries your voice and the context you choose into the moments
                you can’t make—without pretending to be you.
              </p>
            </div>
          </div>
          <div className="concept-aside reveal">
            <p className="aside-label">A DIGITAL PRESENCE, ON YOUR TERMS</p>
            <div className="presence-mark" aria-hidden="true">
              <span />
              <span />
              <span />
              <span />
              <span />
            </div>
            <p className="aside-caption">
              It sounds like you.
              <br />
              It knows what you’ve shared.
              <br />
              And it knows when to ask.
            </p>
          </div>
        </section>

        <section className="process-section section-frame" id="how-it-works">
          <div className="section-heading reveal">
            <div>
              <p className="section-kicker">The making of a Shadow</p>
              <h2>
                Presence, built
                <br />
                <em>from the inside out.</em>
              </h2>
            </div>
            <p className="section-heading-note">
              A thoughtful process turns your voice, preferences, and knowledge
              into a representation you control.
            </p>
          </div>
          <div className="process-list">
            <article className="process-row reveal">
              <span className="process-number">01</span>
              <div className="process-title">
                <h3>Capture your voice</h3>
                <span>THE SOUND OF YOU</span>
              </div>
              <p>
                Give your voice a starting point with a short recording. Your
                consent comes first; your voice can be revoked.
              </p>
              <span className="process-mark" aria-hidden="true">
                ↗
              </span>
            </article>
            <article className="process-row reveal">
              <span className="process-number">02</span>
              <div className="process-title">
                <h3>Understand your identity</h3>
                <span>YOUR CONTEXT, YOUR RULES</span>
              </div>
              <p>
                Shape a profile with your communication style, preferences,
                confirmed memories, and the boundaries you define.
              </p>
              <span className="process-mark" aria-hidden="true">
                ↗
              </span>
            </article>
            <article className="process-row reveal">
              <span className="process-number">03</span>
              <div className="process-title">
                <h3>Represent your presence</h3>
                <span>WHEN YOU CAN’T BE THERE</span>
              </div>
              <p>
                Try a conversation or a consent-led live meeting. Responses draw
                on your context and are delivered with clear AI disclosure.
              </p>
              <span className="process-mark" aria-hidden="true">
                ↗
              </span>
            </article>
          </div>
        </section>

        <section className="experience-section section-frame" id="experience">
          <div className="experience-heading reveal">
            <p className="section-kicker">A moment, carried well</p>
            <h2>
              Context in.
              <br />
              <em>Presence out.</em>
            </h2>
            <p>
              An illustrative live-meeting exchange. The Shadow identifies
              itself, uses the owner’s provided context, and speaks a concise
              response.
            </p>
          </div>
          <div className="demo-console reveal">
            <div className="demo-topline">
              <span className="demo-status">
                <i /> EXAMPLE / LIVE MEETING
              </span>
              <span>
                VOICE CHANNEL <b>01</b>
              </span>
            </div>
            <div className="demo-context">
              <span>OWNER CONTEXT</span>
              <p>First version target: Friday</p>
              <span className="context-lock">SAVED FOR THIS MEETING</span>
            </div>
            <div className="demo-turn">
              <span className="turn-index">01 / INCOMING</span>
              <div className="turn-message">
                <span className="speaker">PARTICIPANT</span>
                <p>
                  Could you confirm whether the first version will be ready by
                  Friday?
                </p>
              </div>
            </div>
            <div className="demo-processing">
              <span className="processing-line" />
              <span>TRANSCRIPT → CONTEXT → RESPONSE</span>
              <span className="processing-line" />
            </div>
            <div className="demo-turn demo-turn-response">
              <span className="turn-index">02 / RESPONSE</span>
              <div className="turn-message">
                <span className="speaker speaker-shadow">
                  SHADOW CLONE · AI
                </span>
                <p>
                  Based on the context I have, Friday is the current target for
                  the first version.
                </p>
                <div
                  className="demo-wave"
                  aria-label="Illustrative voice waveform"
                >
                  {waveform.map((height, index) => (
                    <i
                      key={index}
                      style={
                        { "--wave-height": `${height}px` } as CSSProperties
                      }
                    />
                  ))}
                </div>
                <span className="voice-caption">
                  SPOKEN WITH YOUR ENROLLED VOICE · AI DISCLOSED
                </span>
              </div>
            </div>
            <div className="demo-bottomline">
              <span>ILLUSTRATIVE EXAMPLE</span>
              <span>NO CALL CONNECTED</span>
            </div>
          </div>
          <p className="experience-footnote reveal">
            The current workspace supports simulated conversations and a
            browser-tab live meeting workflow. It doesn’t automatically join
            calls or control your meeting app.
          </p>
        </section>

        <section className="technology-section section-frame" id="technology">
          <div className="technology-heading reveal">
            <p className="section-kicker">The signal beneath the surface</p>
            <h2>
              Human in the loop.
              <br />
              <em>Technology in service.</em>
            </h2>
            <p>
              A focused pipeline carries audio and context through the systems
              that make a delegated response possible.
            </p>
          </div>
          <div
            className="architecture reveal"
            aria-label="Shadow Clone response architecture"
          >
            <div className="architecture-node">
              <span className="architecture-step">01</span>
              <span
                className="architecture-icon architecture-mic"
                aria-hidden="true"
              >
                <i />
                <i />
                <i />
                <i />
                <i />
              </span>
              <strong>MEETING AUDIO</strong>
              <small>Consented browser tab</small>
            </div>
            <span className="architecture-link" aria-hidden="true" />
            <div className="architecture-node">
              <span className="architecture-step">02</span>
              <span className="architecture-symbol" aria-hidden="true">
                STT
              </span>
              <strong>GNANI SPEECH</strong>
              <small>Transcription + cloned voice</small>
            </div>
            <span className="architecture-link" aria-hidden="true" />
            <div className="architecture-node">
              <span className="architecture-step">03</span>
              <span
                className="architecture-symbol architecture-context"
                aria-hidden="true"
              >
                CTX
              </span>
              <strong>YOUR CONTEXT</strong>
              <small>Profile + meeting notes</small>
            </div>
            <span className="architecture-link" aria-hidden="true" />
            <div className="architecture-node">
              <span className="architecture-step">04</span>
              <span
                className="architecture-symbol architecture-llm"
                aria-hidden="true"
              >
                LLM
              </span>
              <strong>REASONING</strong>
              <small>Configured language model</small>
            </div>
            <span className="architecture-link" aria-hidden="true" />
            <div className="architecture-node">
              <span className="architecture-step">05</span>
              <span
                className="architecture-icon architecture-output"
                aria-hidden="true"
              >
                {waveform.slice(0, 9).map((height, index) => (
                  <i
                    key={index}
                    style={
                      {
                        "--wave-height": `${Math.max(7, height / 2)}px`,
                      } as CSSProperties
                    }
                  />
                ))}
              </span>
              <strong>VOICE RESPONSE</strong>
              <small>WebSocket audio delivery</small>
            </div>
          </div>
          <div className="technology-notes reveal">
            <span>DESIGNED TO KEEP CONTEXT CLOSE</span>
            <p>
              Meeting notes are saved before you join, then loaded into the live
              session. Consent and AI disclosure stay part of the flow.
            </p>
          </div>
        </section>

        <section className="closing-section">
          <div className="closing-orbit" aria-hidden="true" />
          <div className="closing-content reveal">
            <p className="section-kicker">Your voice, beyond the room</p>
            <h2>
              Be present,
              <br />
              <em>even when you’re not.</em>
            </h2>
            <button
              className="button button-light button-large"
              onClick={() => onAuth("register")}
            >
              Create your Shadow <span aria-hidden="true">↗</span>
            </button>
          </div>
          <span className="closing-index">SHADOW CLONE / 2026</span>
        </section>
      </main>

      <footer className="site-footer">
        <a className="wordmark footer-wordmark" href="#top">
          <span className="wordmark-mark" aria-hidden="true">
            <i />
            <i />
          </span>
          <span>shadow clone</span>
        </a>
        <span className="footer-note">
          VOICE WITH INTENTION. PRESENCE WITH PERMISSION.
        </span>
        <a className="footer-top" href="#top">
          BACK TO TOP ↑
        </a>
      </footer>
    </div>
  );
}
