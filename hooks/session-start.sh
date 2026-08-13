#!/bin/sh
# session-start hook — emit additionalContext so Copilot is aware of the skill.
# No Node.js required; no state or analysis performed.
printf '{"additionalContext":"The instruction-architect plugin is active. When useful during development, use the instruction-architect skill to identify durable repository knowledge that could improve the repository'\''s Copilot instructions, skills, prompts, agents, or documentation. Do not make changes unless they provide a genuine future benefit, and prefer the smallest appropriate change."}\n'
