---
name: project-context-interviewer
description: Ask the user many focused questions to gather deep project context before implementation, refactoring, architecture work, debugging, planning, onboarding, or code review. Use when Codex should slow down and interview the user before touching this HeadlineApp React Native codebase, especially for work involving shows, bands, venues, tickets, auth, location, navigation, Firebase, Redux state, environment configuration, or native mobile behavior.
---

# Project Context Interviewer

Interview the user before making substantial decisions in this repository.

Treat context gathering as the primary task until the user signals enough context has been shared or asks you to move into execution.

This repository appears to be a React Native mobile app with:

- React Native 0.71 and TypeScript
- Redux Toolkit plus thunk-based async flows
- React Navigation with nested stack and bottom-tab routers
- Firebase auth, messaging, and storage
- Environment-based API configuration through `.env`
- Location and reverse geocoding flows
- Product concepts around shows, bands, venues, tickets, profile, checkout, search, and map

Use that knowledge to ask sharper questions. Do not ask generic project questions if the codebase already suggests a better one.

For a larger or ambiguous effort, read [references/question-bank.md](references/question-bank.md) and draw from the most relevant sections instead of improvising everything from scratch.

## Operating Mode

Ask more questions than usual.

Prefer short batches of 4-7 targeted questions instead of one giant questionnaire. After each batch:

1. Summarize what you learned in 3-6 bullets.
2. Identify contradictions, gaps, or risky assumptions.
3. Ask the next batch of follow-up questions.

Continue this loop until one of these is true:

- The user explicitly asks you to stop interviewing and proceed.
- You can state the goal, constraints, architecture, success criteria, and major risks with confidence.
- Additional questions would become repetitive or low-value.

## Repo-Specific Priorities

Bias your interview toward the areas that matter most in this codebase.

### Product And User Flows

Clarify which flows matter for the current task:

- Explore and show discovery
- Band and venue detail flows
- Tickets and checkout
- Profile and auth
- Search and map
- Create-band or creator-facing workflows

Ask which personas matter most right now, such as concertgoers, artists, venue operators, or admins.

### Data And API Contracts

Clarify which backend entities and contracts are involved:

- Shows
- Bands
- Venues
- Tickets
- Users
- Client context
- Location and geocoding data

Ask which API responses are stable contracts, which are still in flux, and which fields are business-critical.

### State Ownership

Clarify where the source of truth should live:

- Redux slices in `src/features`
- Local component state
- Async storage
- Firebase auth state
- Navigation state

Ask whether the change should update an existing slice, add derived selectors, or stay local to a screen.

### Navigation Behavior

Clarify which screen stacks and deep flows are affected.

This app uses nested navigators and a custom bottom nav. Ask:

- Which entry point starts the flow?
- Which route names or tab transitions are involved?
- Whether auth gating or conditional routing matters
- Whether checkout should block gestures or back navigation

### Platform And Environment Differences

Clarify whether behavior differs across:

- iOS vs Android
- development vs alpha vs production env files
- simulator vs physical device
- signed-in vs signed-out state
- permission granted vs denied state

If the task touches APIs, secrets, Firebase, or Google location services, ask how environments are currently managed and which env must be treated as authoritative.

### Native Mobile Risks

Ask explicitly about:

- Permissions
- Push notifications
- Geolocation behavior
- Device-specific bugs
- Performance on slower phones
- Offline or flaky network behavior

## Question Style

Ask concrete questions, not generic ones.

Prefer questions like:

- "Which user flow is failing right now: Explore, Map, Tickets, Profile, or a nested details screen?"
- "Is the source of truth for this behavior supposed to live in a Redux slice, a screen component, or Firebase state?"
- "Does this need to behave the same on iOS and Android, or is one platform the priority?"
- "Which API payloads or Firebase-side assumptions would be dangerous for me to change?"
- "If I fix this locally, what is most likely to break next: navigation, auth, location, checkout, or data normalization?"

Avoid:

- Vague single-question prompts like "Can you give more context?"
- Long preambles before the questions
- Re-asking information the user already gave
- Pretending uncertainty about the stack when the repository already shows it

Use follow-up questions aggressively when answers imply hidden complexity.

## Project-Specific Synthesis Rules

Keep a lightweight working model of the project as you learn:

- Product area in scope
- Screens and routes involved
- State owners
- API or Firebase dependencies
- Platform and environment constraints
- Major risks
- Open questions

Reflect this model back to the user periodically so they can correct it.

When enough context is available, present a brief alignment summary before acting:

1. What area of HeadlineApp you believe is in scope
2. What the user wants changed now
3. Which slices, screens, routes, APIs, or native concerns are likely involved
4. Which constraints and risks matter most
5. What assumptions remain

Then either proceed or ask the final missing questions.

## Guardrails

Do not hide behind endless discovery. Once the high-risk unknowns are resolved, move forward.

If the user seems impatient, switch to the 3 most decision-critical questions only.

If the user explicitly wants action immediately, summarize assumptions and proceed.

If the task is tiny and low-risk, ask only a minimal context batch.

If the task concerns a clearly identified file or bug, ask only the questions needed to avoid breaking the relevant flow.
