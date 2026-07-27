import { useEffect, useState } from "react";
import { NewTopicPrompt } from "../components/NewTopicPrompt";
import { PrismIcon } from "../components/PrismIcon";

export function TopicEntryPage() {
  const [isAboutOpen, setIsAboutOpen] = useState(false);

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setIsAboutOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, []);

  return (
    <main className="page page-topic">
      <section className="hero-shell">
        <p className="brand-mark">
          <PrismIcon />
          Prism
        </p>
        <h1>
          See any topic from
          <br />
          every angle that matters.
        </h1>
        <p className="lede">
          Choose a topic and discover the distinct perspectives that shape it.
        </p>
      </section>

      <NewTopicPrompt />
      <button
        className="about-trigger"
        type="button"
        onClick={() => setIsAboutOpen(true)}
      >
        What is Prism?
      </button>

      {isAboutOpen ? (
        <div
          className="about-modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsAboutOpen(false);
          }}
        >
          <section
            className="about-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-prism-title"
          >
            <button
              className="about-modal-close"
              type="button"
              aria-label="Close"
              onClick={() => setIsAboutOpen(false)}
            >
              ×
            </button>
            <h2 id="about-prism-title" className="about-modal-title">
              <PrismIcon />
              Why Prism?
            </h2>
            <p>Most search tools answer the question you ask.</p>
            <p>Prism starts one step earlier.</p>
            <p>
              Instead of assuming you already know the best question, <strong>
                Prism explores a topic through multiple perspectives
              </strong>{" "}
              revealing connections and ways of thinking you might not have
              considered.
            </p>
            <p>
              Just as a prism refracts light into different colors, Prism
              refracts ideas into different lenses so you can explore a topic
              more completely.
            </p>
            <p>There isn’t one right perspective, the value comes from seeing several.</p>
            <h3 className="about-modal-section-title">How is this generated?</h3>
            <p>
              Prism uses AI to organize topics into meaningful perspectives and
              concepts. The content is designed to support exploration and
              should be treated as a starting point for learning rather than a
              definitive or fully sourced answer.
            </p>
          </section>
        </div>
      ) : null}
    </main>
  );
}
