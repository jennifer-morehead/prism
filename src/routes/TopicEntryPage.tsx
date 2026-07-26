import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTopicSession } from "../features/topic/topic.api";

export function TopicEntryPage() {
  const navigate = useNavigate();
  const [topic, setTopic] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const result = await createTopicSession({ topicText: topic });
      navigate(`/session/${result.topicSession.id}/lenses`);
    } catch (submitError) {
      const message =
        submitError instanceof Error
          ? submitError.message
          : "Failed to create session";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="page page-topic">
      <section className="hero-shell">
        <p className="eyebrow">Prism Lens Studio</p>
        <h1>Reframe Any Topic Through Competing Perspectives</h1>
        <p className="lede">
          Enter a topic, pick a lens, and generate a structured exploration with
          concepts and explicit causal connections.
        </p>
      </section>

      <form onSubmit={handleSubmit} className="topic-form">
        <input
          type="text"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Try: dog training, cat nutrition, AI in healthcare"
          aria-label="Topic"
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Opening Session..." : "Generate Perspectives"}
        </button>
      </form>
      {error ? <p className="inline-error">{error}</p> : null}
    </main>
  );
}
