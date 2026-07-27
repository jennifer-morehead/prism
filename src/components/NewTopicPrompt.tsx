import { FormEvent, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { createTopicSession } from "../features/topic/topic.api";
import {
  randomDemoTopic,
  randomDemoTopicChoices,
} from "../lib/demoTopics";

interface NewTopicPromptProps {
  showSuggestions?: boolean;
  excludeTopic?: string;
}

export function NewTopicPrompt({
  showSuggestions = true,
  excludeTopic,
}: NewTopicPromptProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const [topic, setTopic] = useState(() => randomDemoTopic(excludeTopic));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState(() =>
    randomDemoTopicChoices(topic),
  );

  useEffect(() => {
    if (!excludeTopic) return;
    const nextTopic = randomDemoTopic(excludeTopic);
    setTopic(nextTopic);
    setSuggestions(randomDemoTopicChoices(nextTopic));
  }, [excludeTopic]);

  const chooseTopic = (nextTopic: string) => {
    setTopic(nextTopic);
    setSuggestions(randomDemoTopicChoices(nextTopic));
  };

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
          readOnly
          placeholder={
            pathname === "/"
              ? "Enter a topic to explore"
              : "Enter a new topic to explore"
          }
          aria-label="Selected topic"
          maxLength={120}
          required
        />
        <button
          type="submit"
          className={isSubmitting ? "refracting-cta" : undefined}
          disabled={isSubmitting}
        >
          <span>{isSubmitting ? "Refracting..." : "Explore"}</span>
        </button>
      </form>
      {showSuggestions ? (
        <>
          <div className="topic-suggestions" aria-label="Suggested topics">
            <span className="suggestions-label">Try:</span>
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                className="suggested-topic"
                type="button"
                onClick={() => chooseTopic(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <p className="custom-topic-availability availability-copy">
            Custom topics available in full Prism
          </p>
        </>
      ) : null}
      {error ? <p className="inline-error">{error}</p> : null}
    </section>
  );
}
