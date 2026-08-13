# Improve Copilot customisation

Use the current conversation and current repository context to identify durable knowledge that could improve this repository's Copilot customisation.

Review the existing instructions, prompts, skills, agents, and any closely related documentation. Then decide whether a small persistent improvement is warranted.

Valid outcomes include:

- no change
- removing duplicated, stale, contradictory, or trivially discoverable guidance
- moving guidance into a better scope or artefact
- adding a small amount of durable missing guidance
- preserving the repository exactly as-is because that is already the best outcome

Constraints:

- do not rely on an observation database or reconstructed conversation history
- use only the current conversation and repository context already available to Copilot
- keep changes small and low-maintenance
- prefer no change over speculative customisation
- preserve useful existing knowledge
