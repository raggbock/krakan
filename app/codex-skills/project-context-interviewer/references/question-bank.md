# Question Bank

Use this file when the task is ambiguous, high-risk, cross-cutting, or likely to benefit from a deeper interview.

Do not dump this as one giant form. Select the most relevant 4-7 questions per round and adapt wording to the user's answers.

## Product Scope

- Which part of HeadlineApp is in scope right now: explore, map, search, tickets, checkout, profile, auth, band creation, or venue details?
- Which user type matters most for this task: attendee, artist, venue, or internal/admin?
- What is the real user outcome behind this request?
- Which flow is most business-critical today?
- What would count as success from the user's perspective?
- What would make the change feel like a failure even if the code technically works?

## Screens And Navigation

- Which screen does the user start on?
- Which screen or modal should they end on?
- Which route names or nested navigators are involved?
- Is the issue inside the bottom-tab flow or in a pushed stack screen like checkout or details?
- Does auth state change the route behavior?
- Should back navigation, gestures, or tab switching be restricted during this flow?

## State And Data Ownership

- Where should the source of truth live for this behavior?
- Which existing slice owns the data now: auth, navigation, location, venues, shows, bands, theme, or context?
- Is there already a selector or thunk I should reuse?
- Should this state persist across screens, app restarts, or just one interaction?
- Is local component state acceptable here, or do you want this standardized in Redux?

## API And Backend Contracts

- Which API endpoint or backend entity does this touch?
- Are we working with shows, bands, venues, tickets, users, or client context?
- Which response fields are relied on elsewhere in the app?
- Are any payloads considered unstable or temporary?
- Is there backend work in progress I need to design around?
- Should I optimize for strict API compatibility or for cleaning up frontend assumptions?

## Auth And Firebase

- Is the user logged in when this flow occurs?
- Does this depend on email login, phone login, signup, or signout behavior?
- Is Firebase auth the real source of truth, or is app state allowed to diverge temporarily?
- Are messaging, storage, or other Firebase features involved?
- Are there auth edge cases around session restore or partial account creation?

## Location And Permissions

- Does the task depend on current location, reverse geocoding, or typed addresses?
- Should the experience degrade gracefully when location permission is denied?
- Is accuracy important, or is approximate location acceptable?
- Are there platform-specific permission issues already known?
- Which failures matter more here: slow geocoding, missing address data, or wrong coordinates?

## Platform And Environments

- Is this bug or feature reproducible on both iOS and Android?
- Which environment matters: development, alpha, or production?
- Are `.env` values stable enough to build against, or are they frequently changed?
- Is this only happening on simulator/emulator, or also on a real device?
- Are there release-specific constraints I should know about?

## UX And Performance

- Is responsiveness more important than architectural cleanliness here?
- Are we trying to minimize taps, loading states, or perceived latency?
- Which screens feel most fragile or slow today?
- Are animations, gestures, or image loading relevant to the issue?
- Is there a specific device class or network condition we need to optimize for?

## Existing Pain And Team Preferences

- What has already been tried?
- Which part of the app do people avoid touching because it breaks easily?
- Are there patterns in this repo you want me to follow more closely?
- Are there patterns in this repo you want me to avoid even if they already exist?
- How much testing is expected for a change like this?
- Do you want the smallest safe patch or a broader cleanup if I see one?
