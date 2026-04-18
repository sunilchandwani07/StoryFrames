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

export async function analyzePrompt(prompt: string, image?: { mimeType: string; data: string } | null) {
  return withRetry(async () => {
    const cacheKey = `analyze_${hashString(prompt + (image ? "with_image" : ""))}`;
    const cached = cache.get(cacheKey);
    if (cached) return cached;

  const contents: any[] = [
    {
      text: `You are the "Pre-Production Analysis Unit." Your goal is to analyze the user's "idea" and prepare it for a professional film production team (Script Writer, Director, Cinematographer, etc.).
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
2. Provide up to 3 improved versions of the prompt that act as a "Finalized Script" by adding necessary details (character appearance, setting, mood, style, camera angles, lighting, lens attributes) for a better storyboard. CRITICAL: Each suggested prompt MUST be strictly under 3000 characters in length.
Crucially, these suggestions should describe the story scene-by-scene and frame-by-frame in continuation with the crux of the story.

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

  const response = await getAI().models.generateContent({
    model: "gemini-2.5-flash",
    contents: { parts: contents },
    config: {
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
                visualDescription: { type: Type.STRING },
              },
            },
            description: "Characters identified from the uploaded image.",
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
              },
            },
            description: "Suggested improvements if status is average or weak.",
          },
        },
        required: ["status", "analysis"],
      },
    },
  });

  let text = response.text || "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }
  const result = JSON.parse(text);
  cache.set(cacheKey, result);
  return result;
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
      text: `You are the "Storyboard Brain," a collaborative team of world-class film professionals working together to transform a user's "idea" into a production-ready storyboard.

THE PRE-PRODUCTION TEAM:
1. SCRIPT WRITER: Finalizes the user's initial idea into a professional screenplay structure, ensuring narrative depth and pacing.
2. STORY SUPERVISOR: Ensures the narrative arc is tight, emotionally resonant, and strictly follows the finalized script.
3. SCENE ANALYSER: Breaks down the technical requirements, continuity, and logical flow of each scene.
4. DIRECTOR: Defines the overall vision, character expressions, and emotional beats. Coordination of physical emotional markers like redness in eyes, pupil dilation, and tense facial muscles.
5. ASSISTANT DIRECTOR: Coordinates all units, ensuring the logic of the pre-production plan is sound.
6. CINEMATOGRAPHER & CAMERAMAN: Chooses the precise camera angles, lens types (e.g., 35mm, 85mm), and framing. CRITICAL: If both character and background references are provided, process them INDIVIDUALLY first. Determine the camera focus, depth of field, and angle required to SEAMLESSLY INTEGRATE the main character into the background environment. CRITICAL PROPORTION RULE: Maintain realistic character-to-environment proportions. Do not make the character unnaturally large or fill the entire frame unless it is a specific Extreme Close-Up. Ensure the environment is visible and provides context. DYNAMIC POSING RULE: Every frame must feature a unique, action-oriented pose for the characters. Never use static standing poses unless explicitly required by the script.
7. LIGHTING DIRECTOR: Designs the global and local lighting to enhance the mood (e.g., Rembrandt, high-key). CRITICAL: Must analyze the background reference's native lighting and harmonize the character's lighting to match it perfectly, including rim lighting, contact shadows, and color temperature.
8. COSTUME DESIGNER: Defines specific attire, fabrics, and accessories for character consistency. CRITICAL: The Costume Designer must provide granular details on practical wear-and-tear, including wrinkles, dirt, mud, sweat marks, misalignment of buttons, and fabric distressing. This "Distressing Profile" must strictly match the character's emotional state and physical history in the story (e.g., a character experiencing high stress or physical struggle should have sweat-soaked collars, disheveled sleeves, and torn seams; a character in a chase should have layers of mud and grime that match the environment).
9. MAKEUP & HAIR DIRECTOR: Designs and maintains the character's physical state. CRITICAL: Must specify details like sweat levels (glisten, beads, soaked), scratches/lacerations, muddy or grimy skin, dirt under nails, and disturbed/wind-blown/matted hair. These details must evolve logically with the scene's intensity.
10. CHOREOGRAPHY/DANCE DIRECTOR: Plans movement, rhythm, and physical blocking for every frame. Ensure characters feel physically connected to the environment (e.g., feet touching the ground, interacting with objects).
11. PRODUCTION DESIGNER & ART DIRECTOR: Analyzes the background reference to conceptualize the set design, architecture, and overall visual world. Ensure the set feels "lived-in" and interactive.
12. SET DIRECTOR & DECORATOR: Fills the conceptualized set with appropriate props, textures, and atmospheric details.

PROJECT PARAMETERS:
Prompt (The Idea): "${prompt}"
Number of Scenes: ${numScenes}
Frames per Scene: ${framesPerScene}

CRITICAL COPYRIGHT RULE: You MUST NOT use or reference copyrighted characters, franchises, or specific intellectual property. Adapt them into generic, original equivalents.

${image ? "CRITICAL: A character reference image has been provided. The team MUST use the characters from this image as the primary reference for identity and appearance." : ""}
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
- Lighting Model: Global warm sunlight (5500K) with soft ray-traced shadows (unless overridden by the specific style).
- Texture Constraint: Maintain consistent textures appropriate for the chosen style.
- Anti-Drift Rule: Maintain depth, material gloss, and shadow softness.
- Atmospheric Consistency: Constant 5% "Volume Fog".
- Background Rule: Backgrounds must be clean and professional. NO text, NO logos, NO posters with writing. Replace any text-heavy backgrounds from reference images with clean, cinematic environments.

PRODUCTION BIBLE & CONTINUITY LOG:
- The team must create a mental "Production Bible" for this project.
- Maintain a strict "Continuity Log" for character height, hair style, eye color, and specific costume details across all ${numScenes} scenes.
- If a character is introduced in Scene 1, their appearance must be perfectly preserved in Scene ${numScenes}.

For each frame, provide:
- Caption: 1-line description of the narrative action.
- Image Prompt: Highly detailed prompt for the image generator. MUST describe physical orientation, body language, weight distribution, and concrete interaction with the environment (e.g., 'stumbling backward over loose rocks', 'leaning against a damp cave wall'). Avoid generic descriptions like 'looking in awe'.
- Camera Intent: Precise placement, specific lens choice, and camera height/tilt. 
- Lighting Intent: Specific lighting setup (e.g., 'harsh top-lighting creating deep eye sockets', 'backlit with a blue rim light').
- Character Expression: Detailed emotional state including eyebrow position, mouth shape, and eye focus. Explicitly mention physical signs like redness in eyes or dilated pupils if narrative-appropriate.
- Makeup & Hair Detail: Specific physical state markers (e.g., 'sweat beads glistening on forehead', 'fresh red scratch across right cheek', 'hair matted with dirt and sweat', 'grime visible under finger nails').
- Costume Design: Exhaustive description of the state of attire. Must specify wrinkles, sweat patches (underarms, chest, back), dirt/mud placement, button misalignment, and specific fabric wear (e.g., 'heavy sweat soaked through the charcoal suit jacket', 'left sleeve torn with visible fraying', 'clay-colored mud coating the knees of denim jeans'). Ensure the level of disarray or sharpness matches the character's current emotion and the scene's intensity.
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

  const response = await getAI().models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
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
                      caption: { type: Type.STRING },
                      imagePrompt: { type: Type.STRING },
                      cameraIntent: { type: Type.STRING },
                      lightingIntent: { type: Type.STRING },
                      characterExpression: { type: Type.STRING },
                      makeupAndHairDetail: { type: Type.STRING },
                      costumeDesign: { type: Type.STRING },
                      cinematographyNotes: { type: Type.STRING },
                    },
                    required: ["frameNumber", "caption", "imagePrompt", "cameraIntent", "lightingIntent", "characterExpression", "makeupAndHairDetail", "costumeDesign", "cinematographyNotes"],
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

  let text = response.text || "{}";
  const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
  if (jsonMatch) {
    text = jsonMatch[0];
  }
  const result = JSON.parse(text);
  cache.set(cacheKey, result);
  return result;
  });
}

const withRetry = async <T>(fn: () => Promise<T>, retries: number = 3, delay: number = 5000): Promise<T> => {
  try {
    return await fn();
  } catch (error: any) {
    if (retries > 0 && (error?.message?.includes("429") || error?.message?.includes("RESOURCE_EXHAUSTED"))) {
      console.warn(`Rate limit hit, retrying in ${delay / 1000} seconds... (${retries} retries left)`);
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

    if (sampleImage) {
      parts.push({ text: "[IMAGE 1: CHARACTER REFERENCE]" });
      parts.push({
        inlineData: {
          data: sampleImage.data,
          mimeType: sampleImage.mimeType,
        },
      });

      if (referenceType === "composition") {
        referenceText += "CRITICAL: Use [IMAGE 1] as a strict structural and composition reference. Maintain the EXACT SAME character poses and facial expressions. ";
      } else if (referenceType === "scene_consistency") {
        referenceText += "CRITICAL: Use [IMAGE 1] as a consistency reference for the environment, lighting, and character identity. However, YOU MUST change the character's pose, expression, and position to match the new action described in the prompt. Do not replicate the exact composition of [IMAGE 1]. ";
      } else {
        referenceText += "CRITICAL: Use [IMAGE 1] as a strict visual reference for the MAIN character's identity, facial features, and clothing. ANTI-CLONING RULE: If there are multiple distinct characters in the scene, DO NOT apply the main character's face to everyone. Maintain distinct identities, body types, and specific props (like glasses or mustaches) for each unique character as described in the prompt. UNIFORM INTEGRATION: Ensure the character is naturally rendered into the scene with matching lighting and shadows. ";
      }
    }

    if (backgroundImage) {
      parts.push({ text: "[IMAGE 2: BACKGROUND REFERENCE]" });
      parts.push({
        inlineData: {
          data: backgroundImage.data,
          mimeType: backgroundImage.mimeType,
        },
      });

      referenceText += "CRITICAL: Use [IMAGE 2] as a conceptual blueprint and set design reference for the environment. The Production Designer, Set Decorator, and Art Directors have used this to build the set. The background should capture the essence, architecture, and atmosphere of [IMAGE 2], allowing the Cinematographer and Lighting Unit to dynamically frame and light the scene. DO NOT pull character identities or faces from [IMAGE 2]. If [IMAGE 2] contains a crowd or people, treat them as generic, out-of-focus background extras, NOT the main character. INTEGRATION RULE: The character must NOT look like they are 'pasted' or 'overlayed' on [IMAGE 2]. They must be part of the world, with shadows cast on the floor, ambient light reflecting on their skin/clothes, and a consistent depth of field that matches the lens choice. ";
    }

    let styleRule = "";
    if (userStylePreference === "Photorealistic Human") {
      styleRule = "[STYLIZATION RULE] CRITICAL: The user has requested 'Photorealistic Human'. You MUST generate a live-action, highly detailed photographic image. Use 8k resolution, raw photography feel, ultra-realistic skin textures, and cinematic color grading. DO NOT generate an illustration, painting, or 3D render.";
    } else if (userStylePreference === "3D Cartoon") {
      styleRule = "[STYLIZATION RULE] CRITICAL: The user has requested '3D Cartoon'. Generate an image that looks like a frame from a high-budget 3D animated film (e.g., Pixar, Disney). Use stylized proportions, vibrant lighting, subsurface scattering on skin, and soft depth of field.";
    } else {
      styleRule = `[STYLIZATION RULE] CRITICAL: Adhere strictly to the requested style: ${userStylePreference}. Preserve the character's core identity and adapt it cleanly to this style without uncanny valley fusion. Keep the visual tone cohesive.`;
    }

    const negativePrompt = `[NEGATIVE RULES - AVOID THESE AT ALL COSTS] NO text, NO watermarks, NO signatures, NO logos, NO ui elements, NO blurry elements, NO deformed anatomy, NO extra fingers, NO poorly drawn faces, NO duplicate characters, NO out of frame elements, NO unnatural lighting, NO washed out colors, NO pasted overlays.`;

    parts.push({
      text: referenceText + imagePrompt + ` [QUALITY RULES] Professional cinematic grade output. High-end rendering with cinematic lighting. ${styleRule} ${negativePrompt} [CLEANLINESS RULES] ABSOLUTELY NO text, NO logos, NO posters with writing, NO watermarks, NO signatures, and NO text-based branding. Replace any text-heavy backgrounds with clean, architectural walls or generic artistic environments. [CONSISTENCY RULES] Maintain exact jawline, facial anatomy, and body structure. Only change emotional expressions and poses as directed. CRITICAL: Strictly adhere to all details in the prompt, especially COSTUME DISTRESSING (wrinkles, sweat, dirt, mud, wear and tear) and MAKEUP/HAIR DETAILS (sweat beads, scratches, eye redness, disheveled hair). These details are narrative-critical. Apply constant volumetric lighting.`,
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
      },
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
    throw new Error("Failed to generate image.");
  });
}
