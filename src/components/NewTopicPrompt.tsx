import { FormEvent, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createTopicSession } from "../features/topic/topic.api";

export function NewTopicPrompt() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
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
    <section className="new-topic-prompt">
      <form onSubmit={handleSubmit} className="topic-form">
        <input
          type="text"
          value={topic}
          onChange={(event) => setTopic(event.target.value)}
          placeholder={
            pathname === "/"
              ? "Enter a topic to explore"
              : "Enter a new topic to explore"
          }
          aria-label="New topic"
          required
        />
        <button type="submit" disabled={isSubmitting}>
          {isSubmitting ? "Refracting..." : "Explore"}
        </button>
      </form>
      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}
