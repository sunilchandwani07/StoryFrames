import { GoogleGenAI, Type } from "@google/genai";

let aiInstance: GoogleGenAI | null = null;

function getAI() {
  if (!aiInstance) {
    // Fallback to VITE_GEMINI_API_KEY if process.env is not populated (e.g., standard Vite build without custom define)
    const apiKey = process.env.GEMINI_API_KEY || (import.meta as any).env?.VITE_GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("Gemini API Key is missing. Please set GEMINI_API_KEY in your Vercel Environment Variables and redeploy.");
    }
    aiInstance = new GoogleGenAI({ apiKey });
  }
  return aiInstance;
}

// Simple hash function for cache keys
const hashString = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return hash.toString(36);
};

// Simple cache to store and reuse generated patterns from the API
const cache = {
  get: (key: string) => {
    try {
      const item = localStorage.getItem(`storyframes_cache_${key}`);
      if (!item) return null;
      const { value, expiry } = JSON.parse(item);
      if (Date.now() > expiry) {
        localStorage.removeItem(`storyframes_cache_${key}`);
        return null;
      }
      return value;
    } catch (e) {
      return null;
    }
  },
  set: (key: string, value: any, ttl: number = 3600000) => { // Default 1 hour TTL
    try {
      const item = {
        value,
        expiry: Date.now() + ttl,
      };
      localStorage.setItem(`storyframes_cache_${key}`, JSON.stringify(item));
    } catch (e) {
      // Handle quota exceeded or other storage errors
      console.warn("Cache storage failed", e);
    }
  }
};

// Simple hash function for seed conversion
const stringToSeed = (str: string) => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  return Math.abs(hash);
};

export async function analyzePrompt(prompt: string, image?: { mimeType: string; data: string } | null) {
  return withRetry(async () => {
    const cacheKey = `analyze_${hashString(prompt + (image ? "with_image" : ""))}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

  const contents: any[] = [
    {
      text: `You are the "Executive Pre-Production Analysis Unit." Your goal is to analyze the user's "idea" and prepare it for a professional film production team. You act as the Senior Producer who makes the final call on technical viability.
Prompt (The Idea): "${prompt}"

${image ? "CRITICAL: An image has been provided as a visual reference. You MUST identify the characters in this image and provide highly detailed visual descriptions (clothing, hair, facial features, age, ethnicity) for them. These descriptions will be used to maintain character consistency throughout the storyboard. If the user's prompt mentions characters, map them to the people in the image." : ""}

Evaluate the idea based on these parameters:
1. Title: Suggest a fitting production title.
2. Number of Characters: Identify or suggest the number of characters.
3. Number of Scenes: Suggest an optimal number of scenes for a professional narrative arc.
4. Objective: What is the core objective of this story?
5. Message: What is the underlying message or theme?
6. Copyright Check: Check if the prompt explicitly requests copyrighted characters, franchises, or specific intellectual property. If it does, set 'isCopyrighted' to true and provide a 'copyrightReason'.

Also, check if the user explicitly provided: Story Title, Number of Characters, Number of Scenes, Number of Frames, Camera Angles, Lighting, and Lens Attributes.
If the user's prompt is missing these key ingredients, classify it as "average" or "weak" because it requires professional finalization by the pre-production units.
If the prompt contains copyrighted material, you MUST classify it as "weak", set 'isCopyrighted' to true, and ensure all 'suggestions' replace the copyrighted elements with generic, original equivalents.

Check for consistency between these parameters and the crux of the story.

Classify it as "good", "average", or "weak".
If it is "average" or "weak":
1. Provide a "guide" that lists the missing elements, explains the ingredients of a perfect storyboard prompt, and gives a short example of a good prompt.
2. Provide up to 3 improved versions of the prompt that act as a "Finalized Script" by adding necessary details (character appearance, setting, mood, style, camera angles, lighting, lens attributes) for a better storyboard. For each suggestion, provide the breakdown of 'scenes', 'framesPerScene', and a list of 'characters' included. CRITICAL: Each suggested prompt MUST be strictly under 2700 characters in length (well below the 3000 max limit).
CRITICAL: These suggestions MUST NOT change the core idea of the story, break the continuity of the scenes, or fundamentally alter the user's narrative. They exist ONLY to add the missing technical pre-production details (camera, lighting, director notes) while keeping the original story flowing perfectly scene-by-scene and frame-by-frame.

Return the result as JSON.`
    }
  ];

  if (image) {
    contents.push({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType
      }
    });
  }

    const genResponse = await getAI().models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: contents },
      config: {
        seed: stringToSeed(prompt),
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            status: {
              type: Type.STRING,
              enum: ["good", "average", "weak"],
              description: "The classification of the prompt.",
            },
            analysis: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                numCharacters: { type: Type.INTEGER },
                numScenes: { type: Type.INTEGER },
                objective: { type: Type.STRING },
                message: { type: Type.STRING },
                consistencyCheck: { type: Type.STRING, description: "Analysis of consistency between parameters and the story crux." }
              },
              required: ["title", "numCharacters", "numScenes", "objective", "message", "consistencyCheck"]
            },
            isCopyrighted: { type: Type.BOOLEAN, description: "True if the prompt requests copyrighted material." },
            copyrightReason: { type: Type.STRING, description: "Explanation of the copyright issue and suggesting a generic alternative." },
            identifiedCharacters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  visualDescription: { type: Type.STRING, description: "Highly detailed description including jawline, nose shape, eye spacing, specific lip and mouth architecture, cheekbone height, specific skin undertones, and unique anatomy markers." },
                },
                required: ["name", "visualDescription"],
              },
              description: "Characters identified from the uploaded image with exhaustive anatomical detail to ensure production locking.",
            },
            guide: {
              type: Type.OBJECT,
              properties: {
                missingElements: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of missing parameters like Title, Characters, Scenes, Frames, Camera Angles" },
                ingredients: { type: Type.STRING, description: "Explanation of what makes a good prompt" },
                example: { type: Type.STRING, description: "A short example of a perfect prompt" }
              },
              description: "A guide on how to write a better prompt, provided if status is average or weak."
            },
            suggestions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  prompt: { type: Type.STRING },
                  explanation: { type: Type.STRING },
                  scenes: { type: Type.INTEGER, description: "Number of scenes in this suggested prompt." },
                  framesPerScene: { type: Type.INTEGER, description: "Number of frames per scene in this suggested prompt." },
                  characters: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Names of characters identified in this suggested prompt." },
                },
                required: ["prompt", "explanation", "scenes", "framesPerScene", "characters"],
              },
              description: "Suggested improvements if status is average or weak.",
            },
          },
          required: ["status", "analysis"],
        },
      },
    });

    const text = genResponse.text || "";
    if (!text) {
      throw new Error("The AI returned an empty response. Please try again or simplify your prompt.");
    }
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      const cleanedJson = jsonMatch ? jsonMatch[0] : text;
      const result = JSON.parse(cleanedJson);
      cache.set(cacheKey, result);
      return result;
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", text);
      throw new Error("The AI response could not be analyzed correctly. Please try a different prompt.");
    }
  });
}

export async function planStoryboard(
  prompt: string, 
  numScenes: number, 
  framesPerScene: number, 
  existingCharacters: any[] = [], 
  image?: { mimeType: string; data: string } | null,
  backgroundImage?: { mimeType: string; data: string } | null,
  userStylePreference: string = "Cinematic Realistic"
) {
  return withRetry(async () => {
    const cacheKey = `plan_${hashString(prompt + numScenes + framesPerScene + JSON.stringify(existingCharacters) + (image ? "with_image" : "") + (backgroundImage ? "with_bg" : "") + userStylePreference)}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

  const contents: any[] = [
    {
      text: `You are the "Head of Production," the Executive Director of the Storyboard AI project. Your vision is the final law. Your task is to finalize a production bible for a professional film shoot based on the user's prompt. All instructions provided by the "Director" persona are MANDATORY DIRECTIVES.

THE PRE-PRODUCTION TEAM (Led by the DIRECTOR):
1. DIRECTOR (THE VISIONARY): The ultimate authority. Provides the final "Director's Treatment"—a unified directive on emotional beats, character expressions, and overall mood. Every instruction from the Director MUST be strictly adhered to by all units. 
2. CASTING DIRECTOR: Finalizes the "Casting Call" by analyzing the Reference Character Image (if provided) and locking the character's core structural identity. Identifies "Immutable Structural Markers" (bone structure, skull shape, eyebrow ridge, cheekbone height, jawline geometry, lip/mouth architecture, and inter-pupillary distance). They distinguish between "Structural Architecture" (permanent) and "Styling/Makeup" (changeable layers like hair style, complexion tint) to ensure the base human identity is never lost.
3. SCRIPT WRITER: Finalizes the user's idea into a professional screenplay structure.
4. SCENE NARRATOR: Translates the screenplay into a frame-by-frame narrative, ensuring the "voice" and "pacing" of the storyboard remain compelling.
5. STORY SUPERVISOR: Ensures narrative depth, emotional arcs, and thematic consistency.
6. SCENE ANALYSER & SCENE DIRECTOR: Technical breakdown of scenes. The Scene Director oversees the "blocked" action within each frame and coordinates wait times, rhythms, and spatial logic.
7. ASSISTANT DIRECTOR: Logic, pre-production coordination, and enforcement of the Director's timeline.
8. CINEMATOGRAPHER & CAMERAMAN: Chooses the precise camera angles, lens types (e.g., 35mm, 85mm), and framing. CRITICAL PROPORTION RULE: Maintain realistic character-to-environment proportions. 
9. LIGHTING DIRECTOR: Designs the global and local lighting to enhance the mood. Harmonizes characters with their environments.
10. COSTUME DESIGNER: Defines specific attire and granular "Distressing Profiles" (wear-and-tear) matching the character's current state.
11. MAKEUP & HAIR DIRECTOR: Maintains the "Identity Lock" while adding realistic markers (sweat, dirt, fatigue).
12. CHOREOGRAPHY/DANCE DIRECTOR: Plans movement, rhythm, and physical blocking.
13. PRODUCTION DESIGNER & ART DIRECTOR: Conceptualizes the Reacting Environment (dust, debris, fog, spatial continuity).
14. SET DIRECTOR & DECORATOR: Fills sets with environmental storytelling props and textures.
15. SFX & VFX SUPERVISOR (PHYSICS & REALISM ENGINE): Enforces strictly grounded real-world physical interactions (weight, strain, ground compression).
16. CHARACTER FIDELITY OFFICER (ANATOMY ENFORCER): Relentlessly audits every frame to ensure character architecture (bone structure, facial geometry, eyes/lips/cheeks) matches the Casting Director's finalized reference. They reject any frame where the underlying skeletal identity drifts, even if the costume and makeup are correct. They serve as the guardian of the character's unique facial DNA.
17. FOCUS PULLER & CAMERA OPERATOR (OPTICS & IMPERFECTION): Enforces real-lens interaction. Demands organic optical flaws, missed focus, motion blur, shallow depth of field, and chromatic aberration. Rejects hyper-perfect, everything-in-focus 'plastic' AI renders.

PROJECT PARAMETERS:
Prompt (The Idea): "${prompt}"
Number of Scenes: ${numScenes}
Frames per Scene: ${framesPerScene}

CRITICAL COMMUNICATION:
The Director has finalized the "Casting Call". All units must now synchronize their work based on the Director's Treatment and the Casting Director's identified character. You are the Head of Production overseeing this collaborative effort.

${image ? "CRITICAL: The CASTING DIRECTOR has analyzed the provided character reference and issued a 'MASTER FIDELITY LOCK'. All visual units (Makeup, Costume, Cinematography) MUST use the 'Identity Markers' and 'Skin Tone Signature' extracted from this image as the absolute law for character consistency." : ""}
${backgroundImage ? "CRITICAL: A background reference image has been provided. The Production Designer, Set Director, Set Decorator, and Art Directors MUST use this image as a conceptual blueprint to visualize and construct the set. They must collaborate with the Cinematographer and Lighting Unit to integrate the character naturally into this environment before finalizing the scene." : ""}
${existingCharacters.length > 0 ? `Use these existing characters: ${existingCharacters.map(c => `${c.name} (${c.visualDescription})`).join(", ")}.` : ""}

WORKFLOW:
0. DIRECTOR'S TREATMENT: The Director and Script Writer analyze the core premise to determine the "Story Treatment" (e.g., emotion-driven, action-driven, character-study, world-building) and issue a unified directive to the entire team to ensure everyone is on the same page before processing frames.
1. The Script Writer and Story Supervisor finalize the "idea" into a professional narrative arc based on the Treatment.
2. The Scene Analyser and Assistant Director decompose the story into ${numScenes} logical scenes.
3. The Costume Designer and Director define character looks and expressions.
4. The Cinematographer, Lighting Director, and Choreography Director collaborate on every single frame (${framesPerScene} frames per scene).

VISUAL STYLE MANIFEST:
- Primary Style Directive: ${userStylePreference}. The Director and Art Director MUST strictly enforce this style across all frames.
- Lighting & Emotional Environment: Lighting and set atmosphere (rain, dust, claustrophobia, vastness) MUST directly reflect the character's emotional state.
- Optical Authenticity Rule: Shots MUST NOT be uniformly perfect. Dictate authentic camera imperfections: shallow depth of field, foreground/background blur, motion blur on movement, film grain, or slight focus inaccuracies simulating a real human operator.
- Secondary Constraints: For "Stylized Mix", explicit physical masking must be maintained (e.g. ambient occlusion shadows beneath feet) so characters do not look "pasted" onto the 3D backgrounds. Emphasize emotional weight in expressions despite the comic-book styling.
- Anti-Drift Rule: Maintain depth, material gloss, and shadow softness.
- Deterministic Anti-Hallucination Lock: When multiple characters or species (e.g., human and animal) are in the same frame, you MUST physically separate their descriptions. Explicitly declare their anatomy to prevent 'cross-contamination' (e.g., 'The human male stands on two legs. The tiger stands on four paws. The human does NOT have animal traits. The animal does NOT wear clothes.'). Do NOT allow AI to hallucinate or blend their attributes unless the story explicitly calls for a hybrid.
- Atmospheric Consistency: Constant 5% "Volume Fog" reacting to the light sources.
- Background Rule: Backgrounds must be clean and professional. NO text, NO logos, NO posters with writing. Replace any text-heavy backgrounds from reference images with clean, cinematic environments.

PRODUCTION BIBLE & CONTINUITY LOG:
- Ensure Story & Scene Connectivity: The physical action, lighting transition, and emotional state from Frame 1 MUST logically pour into Frame 2. No sudden jumps in time or space without a narrative reason.
- Maintain a strict "Continuity Log" for character height, hair style, eye color, and specific costume details across all ${numScenes} scenes.
- If a character is introduced in Scene 1, their appearance must be perfectly preserved in Scene ${numScenes}.

For each frame, provide:
- Caption: 1-line description of the narrative action.
- Image Prompt: Highly detailed prompt for the image generator. MANDATORY: Every Image Prompt MUST start with a "Structural Architecture Lock" (precise summary of basic facial geometry identified from the reference image). Follow this with current "Makeup/Styling" layers. Then include physical orientation, weight distribution, and concrete interaction with the environment. CRITICAL: End the prompt with "Camera directives: [Lens mm], [Depth of field/Blur], [grain/imperfections], reflecting [emotion] environment."
- Camera Intent: Precise placement, specific lens (e.g., 85mm portrait, 14mm ultrawide), focus pull (what is blurred vs sharp), and camera height/tilt. 
- Lighting Intent: Specific lighting setup (e.g., 'harsh top-lighting creating deep eye sockets', 'backlit with a blue rim light') tied directly to the emotional mood.
- Character Expression: Grounded, authentic emotional state including jaw tension, mouth shape, and eye focus. Avoid exaggerated 'stock' smiles. Explicitly mention physical signs of emotion (like visible tension or fatigue) logically synchronized with the narrative, but avoid graphic or gory descriptions.
- Makeup & Hair Detail: Specific physical state markers rejecting 'perfect' skin. MANDATORY: Must explicitly mention the "Skin Tone Lock" (e.g., 'Skin tone remains deep olive with gold undertones as per reference'). Add realistic environmental markers like 'sweat beads on forehead', 'smudged soot/dirt', 'wind-swept hair', 'visible fatigue'. Ensure these organically match the expression. Avoid words like 'blood', 'wounds', or 'scratches' to prevent safety blocks.
- Costume Design: Exhaustive description of the state of attire. Must specify wrinkles, sweat/water stains, dirt/dust placement, and specific fabric wear. Ensure the level of disarray or sharpness matches the character's current emotion and the scene's intensity.
- Cinematography Notes: Professional notes on composition using terms like 'Rule of Thirds', 'Leading Lines', 'Golden Ratio', and specific blocking instructions.

Return the result as JSON.`
    }
  ];

  if (image) {
    contents.push({
      inlineData: {
        data: image.data,
        mimeType: image.mimeType
      }
    });
  }

  if (backgroundImage) {
    contents.push({
      inlineData: {
        data: backgroundImage.data,
        mimeType: backgroundImage.mimeType
      }
    });
  }

    const genResponse = await getAI().models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: { parts: contents },
      config: {
        responseMimeType: "application/json",
        seed: stringToSeed(prompt + numScenes + framesPerScene + userStylePreference),
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            storyTreatment: { type: Type.STRING, description: "The Director's unified directive (e.g., emotion-driven, action-driven, character-study) that guides the entire team's approach to the story." },
            storySummary: { type: Type.STRING },
            artStyle: { type: Type.STRING },
            ambience: { type: Type.STRING },
            characters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  visualDescription: { type: Type.STRING },
                },
                required: ["name", "visualDescription"],
              },
            },
            scenes: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  sceneNumber: { type: Type.INTEGER },
                  setting: { type: Type.STRING },
                  description: { type: Type.STRING },
                  frames: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        frameNumber: { type: Type.INTEGER },
                        caption: { type: Type.STRING, description: "The Scene Narrator's 1-line description of the narrative action." },
                        narrativeBeat: { type: Type.STRING, description: "The Scene Narrator's detailed breakdown of the emotional and narrative significance of this frame." },
                        imagePrompt: { type: Type.STRING },
                        cameraIntent: { type: Type.STRING },
                        lightingIntent: { type: Type.STRING },
                        characterExpression: { type: Type.STRING },
                        makeupAndHairDetail: { type: Type.STRING },
                        costumeDesign: { type: Type.STRING },
                        cinematographyNotes: { type: Type.STRING },
                        sceneDirectorNotes: { type: Type.STRING, description: "Director's final technical and creative notes for this specific frame, bridging all units." },
                      },
                      required: ["frameNumber", "caption", "narrativeBeat", "imagePrompt", "cameraIntent", "lightingIntent", "characterExpression", "makeupAndHairDetail", "costumeDesign", "cinematographyNotes", "sceneDirectorNotes"],
                    },
                  },
                },
                required: ["sceneNumber", "setting", "frames"],
              },
            },
          },
          required: ["title", "storyTreatment", "storySummary", "artStyle", "ambience", "characters", "scenes"],
        },
      },
    });

    const text = genResponse.text || "";
    if (!text) {
      throw new Error("The AI returned an empty response during planning. Please try again.");
    }
    
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      const cleanedJson = jsonMatch ? jsonMatch[0] : text;
      const result = JSON.parse(cleanedJson);
      cache.set(cacheKey, result);
      return result;
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON during planning:", text);
      throw new Error("The AI provided a response that could not be processed during the planning phase. Please try again.");
    }
  });
}

const withRetry = async <T>(fn: () => Promise<T>, retries: number = 3, delay: number = 5000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    const errorMsg = error?.message || "Unknown error";
    if (retries > 0 && (errorMsg.includes("429") || errorMsg.includes("RESOURCE_EXHAUSTED") || errorMsg.includes("500") || errorMsg.includes("INTERNAL"))) {
      console.warn(`API error (${errorMsg}), retrying in ${delay / 1000} seconds... (${retries} retries left)`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(fn, retries - 1, delay * 2);
    }
    throw error;
  }
};

export async function generateFrameImage(
  imagePrompt: string, 
  sampleImage?: { mimeType: string; data: string } | null,
  backgroundImage?: { mimeType: string; data: string } | null,
  aspectRatio: "16:9" | "9:16" | "1:1" = "16:9",
  referenceType: "character" | "composition" | "scene_consistency" = "character",
  userStylePreference: string = "Cinematic Realistic"
) {
  return withRetry(async () => {
    let referenceText = "";
    const parts: any[] = [];

    // gemini-2.5-flash-image can throw 500 on complex interlaced image/text prompts
    // Provide images first, then one compressed text prompt at the end.
    if (sampleImage) {
      parts.push({
        inlineData: {
          data: sampleImage.data,
          mimeType: sampleImage.mimeType,
        },
      });
      
      if (referenceType === "composition") {
        referenceText += "Use provided image as a strict structural/composition reference. Keep EXACT character poses/expressions. ";
      } else if (referenceType === "scene_consistency") {
        referenceText += "Use provided image as consistency reference for environment/lighting/identity. Change pose/expression to match prompt action. ";
      } else {
        referenceText += "CRITICAL IDENTITY LOCK: Use provided image for MAIN character's core facial bone structure (jawline, brow ridge, cheekbones), exact eye/lip/mouth geometry, and absolute skin structure. Do NOT drift from these structural markers. Styling, hair, and makeup layers can be added as per action prompt, but the underlying skeletal identity must remain 100% consistent. Blend character naturally into scene lighting/shadows. ";
      }
    }

    if (backgroundImage) {
      parts.push({
        inlineData: {
          data: backgroundImage.data,
          mimeType: backgroundImage.mimeType,
        },
      });
      referenceText += "Use background image as set design blueprint. Do NOT pull characters from it. Integrate main character naturally into this set, cast proper shadows, match depth of field. ";
    }

    let styleRule = "";
    if (userStylePreference === "Photorealistic Human") {
      styleRule = "Style: Gritty Photorealistic Human (raw documentary-style photography, un-airbrushed, natural skin textures with pores/flaws, asymmetrical authentic facial expressions). AVOID overperfection, stock-photo smiles, or plastic symmetry. ";
    } else if (userStylePreference === "3D Cartoon") {
      styleRule = "Style: 3D Cartoon (Pixar/Disney style, stylized proportions, vibrant lighting). ";
    } else if (userStylePreference === "Stylized Mix") {
      styleRule = "Style: Stylized Mix (Spider-Verse style, comic-book half-tones mixed with 3D elements). CRITICAL DIRECTIVE FOR STYLIZED MIX: Do NOT let the stylized shading ruin physical grounding. Characters MUST cast real shadows, interact physically with the set, and maintain extreme emotional depth in facial expressions. Prevent the 'pasted sticker' look by strictly enforcing environmental lighting onto the characters. ";
    } else if (userStylePreference === "Anime / Avatar") {
      styleRule = "Style: High-End 2D/3D Anime. CRITICAL DIRECTIVE: Deterministic physical modeling. Do NOT hallucinate extraneous magical details or glowing elements unless instructed. Strictly prevent attribute bleed between characters. Keep anatomy mathematically accurate within the anime style.";
    } else {
      styleRule = `Style: ${userStylePreference}. `;
    }

    const physicsEngine = `
[GLOBAL PHYSICS & REALISM ENGINE - ACTIVE]
1. GLOBAL PHYSICAL LAWS: Gravity is constant. Weight must be visible through posture, surface compression, and grounded interaction. NO floating objects/limbs. Ensure believable center of mass and inertia.
2. CONTACT & INTERACTION: Surfaces must deform under pressure (skin, cloth, ground). Foot contact requires slight compression and environmental interaction (dust, sand, water). Hands must wrap with tension and grip strength.
3. MATERIAL BEHAVIOR: Skin has soft deformation and subsurface scattering. Cloth has realistic folds, tension, and gravity pull. Metal is rigid with sharp reflections. Water is fluid and reactive. Hair responds to motion/wind. Reject plastic textures.
4. LIGHTING PHYSICS: One unified light system. All objects MUST share identical light direction, shadow softness, and color temperature. Surfaces must reflect, absorb, or scatter light realistically.
5. DEPTH & MOTION: Depth of field must match lens focal length. Perspective must be accurate to the camera type. Motion blur must be consistent with force direction. Environmental reactions (water splashes, dust displacement) are mandatory.

[SECONDARY MICRO-PHYSICS & IMPERFECTION ENGINE - REALITY ENGINE ACTIVE]
- HANDHELD BEHAVIOR: Simulate human-operated camera. Introduce slight tilt deviations (1–3 degrees), minor vertical/horizontal drift, and micro-jitter. Framing corrections should feel like organic lagging adjustments, not perfectly locked. Incorporate a subtle rhythmic "breathing" movement to the frame.
- FRAMING IMPERFECTION: Avoid perfect centering. Use off-balance subjects, occasional headroom inconsistency, and natural obstructions (door frames, foreground blur) that create imperfect visibility. Symmetric composition is forbidden unless explicitly story-demanded.
- OPTICAL & FOCUS TRUTH: Focus is not perfectly locked. Apply slight softness on edges, minor focus breathing, and organic focus transitions. Mimic real-world lens defects: faint chromatic aberration at edges and organic sensor grain in deep shadows.
- EXPOSURE & LIGHT VARIATION: Minor exposure shifts and uneven light falloff. Shadows should have a natural spill and highlights should not be perfectly controlled. Use subtle flicker in artificial light sources.
- ATMOSPHERIC CHAOS: Air is imperfect. Render subtle, unevenly distributed dust, haze, and floating particles. Localized density variation in scanlines of light is mandatory.
- MICRO HUMAN/SURFACE IMPERFECTIONS: Asymmetric posture, imperfect eye focus (not always locked on target), and micro-tension in lips/brow. Surfaces must exhibit "micro-wear" (faint thumbprints on glass, light floorboard scuffs, skin pores).
- CONTROLLED CHAOS LIMITER: These imperfections must NEVER break readability, distort key subjects, or over-shake the frame. The goal is "Real camera captured this," NOT "Camera is broken."

[STYLE COMPATIBILITY LAYER] Adapt physics INTO the style. If Anime or Cartoon, preserve weight and motion logic while applying stylized shading. Appearance is stylized; Physics is realistic.
`;

    const rules = `Rules: professional cinematic grade. NO text/watermarks. DETERMINISTIC ANTI-HALLUCINATION LOCK: Strict isolation of character attributes. If multiple entities exist, absolutely NO CROSS-CONTAMINATION of anatomy (e.g., humans maintain 100% human traits, animals stay 100% animal on 4 legs, no mixed limbs, tails on humans, or human clothing on animals unless explicitly stated). ANATOMY INTEGRITY: Maintain exact bone structure, skin undertones, and facial geometry across all frames. OPTICAL AUTHENTICITY: Reject AI plasticity. Force real-world camera imperfections (shallow depth of field, motion blur on moving subjects, slight focus inaccuracies, lens grain). The environment atmosphere must directly reflect the emotional tension. Frames must look authentically directed and captured by a human cinematographer on a real set. ${physicsEngine} STRICT COMPLIANCE: You MUST follow the requested Camera, Lighting, Costume, and Scene Direction absolutely. Do not ignore them. Do NOT include gore, blood, or graphic violence to ensure safety filters pass.`;

    parts.push({
      text: `${styleRule}${referenceText}${imagePrompt}\n\n${rules}`,
    });

    const response = await getAI().models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: {
        parts,
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
        },
        seed: stringToSeed(imagePrompt + userStylePreference + aspectRatio),
      },
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("Generation blocked by safety filters or no candidates returned.");
    }

    const firstCandidate = response.candidates?.[0];
    if (firstCandidate?.finishReason === "SAFETY" || firstCandidate?.finishReason === "IMAGE_SAFETY" || firstCandidate?.finishReason === "BLOCKLIST") {
      throw new Error("Generation blocked by safety filters. Please soften the violent or graphic descriptions in the prompt.");
    }

    for (const part of firstCandidate?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error(`Failed to generate image. Output trace: ${JSON.stringify(response).substring(0, 200)}`);
  });
}
