import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTopicSession } from "../features/topic/topic.api";

interface NewTopicPromptProps {
  compact?: boolean;
}

export function NewTopicPrompt({ compact = false }: NewTopicPromptProps) {
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
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Failed to create session",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className={`new-topic-prompt ${compact ? "is-compact" : ""}`}>
      {compact ? <p className="new-topic-label">Explore a new topic</p> : null}
      <form onSubmit={handleSubmit} className="topic-form">
        <input
          type="text"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder="Enter a topic to explore"
          aria-label="New topic"
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Opening..." : "Explore"}
        </button>
      </form>
      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}
