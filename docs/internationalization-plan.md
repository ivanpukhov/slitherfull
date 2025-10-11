# Internationalization Rollout Plan

This document outlines a suggested sequence of work for adding multi-language support with automatic locale detection and a lobby-level language selector.

## 1. Discovery and Preparation
1. **Inventory text assets** – Catalogue every user-facing string in the frontend (including lobby UI) and backend-generated messages.
2. **Assess existing tooling** – Verify whether the current stack already includes internationalization (i18n) libraries (e.g., `react-i18next`, `i18next`, server-side helpers). Identify gaps that require new dependencies or configuration.
3. **Define locale codes and fallbacks** – Confirm the locale identifiers (`ru`, `pl`, `en`, `es`) and specify English as the default fallback for unsupported or unidentified locales.

## 2. Internationalization Infrastructure
1. **Introduce or configure i18n library** – Add or configure a localization framework for the frontend (and backend if any server-rendered text is needed). Establish a shared translation file structure (e.g., `locales/<lang>/<namespace>.json`).
2. **Set up translation loading** – Implement lazy-loading or bundling of translation files and ensure language switching updates UI strings without a page reload.
3. **Externalize strings** – Replace hardcoded text in components and backend responses with i18n keys, adding placeholders for dynamic values as needed.

## 3. Automatic Locale Detection
1. **Integrate IP geolocation service** – Choose a geolocation provider (self-hosted database or external API) and build a backend endpoint that maps player IP addresses to ISO country codes.
2. **Map countries to supported locales** – Implement the country-to-language mapping: 
   - Russian (`ru`): Russia, Belarus, Kazakhstan, Kyrgyzstan, Tajikistan, Abkhazia, South Ossetia, Transnistria.
   - Spanish (`es`): Spain, Mexico, Colombia, Argentina, Peru, Chile, Venezuela, Ecuador, Guatemala, Bolivia, Dominican Republic, Cuba, Puerto Rico, Honduras, El Salvador, Nicaragua, Costa Rica, Panama, Paraguay, Uruguay, Equatorial Guinea.
   - Polish (`pl`): Poland.
   - English (`en`): All other countries or as the fallback.
3. **Return detected locale to the client** – Update session initialization (e.g., login or lobby join flow) to send the suggested locale so the frontend can default to it.

## 4. Manual Language Selection
1. **Add lobby language switcher** – Provide a user interface in the lobby allowing players to switch languages manually. Persist the preference (e.g., in user profile, cookies, or local storage) so it overrides auto-detected values.
2. **Synchronize with i18n state** – Ensure manual changes trigger the localization framework to reload the correct translations and that the backend respects stored preferences when applicable.

## 5. Translation Production
1. **Create base English copy** – Finalize the canonical English strings for every key.
2. **Commission translations** – Produce Russian, Polish, and Spanish translations, verifying terminology accuracy for game-specific terms.
3. **Quality assurance** – Have native speakers review the translations in-context to catch layout, grammar, or cultural issues.

## 6. Testing and Validation
1. **Automated tests** – Expand unit/integration tests to cover locale detection logic, fallback behavior, and rendering of localized components.
2. **Manual QA matrix** – Test the UI in all four languages across major flows (login, lobby, gameplay) and verify that automatic detection picks the expected language for sample country IPs.
3. **Performance monitoring** – Confirm that translation loading and geolocation lookups do not introduce unacceptable latency.

## 7. Deployment and Maintenance
1. **Feature flag rollout** – Optionally gate the localization feature behind a flag for staged deployment.
2. **Documentation** – Update developer docs with instructions on adding new languages and maintaining translation files.
3. **Monitoring and support** – Track user feedback, monitor logs for geolocation failures, and plan for future language additions.
