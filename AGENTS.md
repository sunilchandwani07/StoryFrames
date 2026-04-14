# Storyboard AI Project Guidelines

## Core Philosophy
This application is not just a storyboard generator; it is a **Professional Pre-Production Suite**. Every user input is treated as an "Idea" that must be finalized by a collaborative team of world-class film professionals.

## The "Storyboard Brain" Team
The AI must always simulate the following roles during the planning and generation phases:
1. **Script Writer:** Finalizes ideas into professional screenplay structures.
2. **Story Supervisor:** Ensures narrative depth and arc consistency.
3. **Scene Analyser:** Technical breakdown and continuity logic.
4. **Director:** Vision, emotional beats, and character expressions.
5. **Assistant Director:** Logic and pre-production coordination.
6. **Cinematographer & Cameraman:** Precise camera angles, lenses (e.g., 85mm, 35mm), and framing.
7. **Lighting Director:** Mood-driven lighting design (e.g., Rembrandt, 5500K soft daylight).
8. **Costume Designer:** Specific attire, fabrics, and accessory consistency.
9. **Choreography/Dance Director:** Physical blocking and movement rhythm.

## Visual Style & Quality Standards
- **Primary Style:** High-end Cinematic Realism.
- **Character Realism:** Photorealistic textures, natural skin pores, and human proportions. No uncanny valley or overly stylized "plastic" looks.
- **Cleanliness Rule:** ABSOLUTELY NO text, logos, posters with writing, or watermarks in any generated image. Backgrounds must be clean, architectural, or generic artistic environments.
- **Consistency Rule:** Maintain exact jawline, facial anatomy, and body structure of characters across all frames.
- **Background Consistency:** If a background reference image is provided (e.g., Sarojini Nagar), the AI MUST use it as the exclusive setting for the entire storyboard.
- **Atmospheric Consistency:** Constant 5% "Volume Fog" and consistent lighting models (e.g., Global warm sunlight).

## Technical Implementation Rules
- **Lazy AI Initialization:** The `GoogleGenAI` client must be initialized lazily via `getAI()` to prevent crashes if the API key is missing on load.
- **PDF Export:** Must include all professional metadata (Camera, Lighting, Expression, Costume, Director's Notes) for every frame.
- **Caching:** Use the established caching mechanism in `gemini.ts` to save user quota and improve performance.
- **Error Handling:** All Firestore and AI operations must have robust error handling that provides context and prevents app-wide crashes.

## Future-Proofing
- The application logic (prompts, workflow, schema) must remain independent of specific API keys or tiers.
- Always prioritize the "Professional Grade" output instructions in prompts to ensure consistency regardless of the underlying model's default behavior.
