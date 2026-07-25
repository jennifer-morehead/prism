# Prism State Machine

## TopicSession

- created
- lens_selected
- generating
- ready
- failed

Transitions:

- created -> lens_selected
- lens_selected -> generating
- generating -> ready
- generating -> failed
- failed -> generating

## RefractedView

- draft
- generating
- ready
- failed

Transitions:

- draft -> generating
- generating -> ready
- generating -> failed
- failed -> generating

## GenerationRun

- queued
- running
- partial
- succeeded
- failed

Transitions:

- queued -> running
- running -> partial
- running -> succeeded
- partial -> succeeded
- running -> failed
- partial -> failed
