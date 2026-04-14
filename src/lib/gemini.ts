import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

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
  const cacheKey = `analyze_${hashString(prompt + (image ? "with_image" : ""))}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const contents: any[] = [
    {
      text: `Analyze the following storyboard prompt for clarity, detail, and visual potential.
Prompt: "${prompt}"

${image ? "CRITICAL: An image has been provided as a visual reference. You MUST identify the characters in this image and provide highly detailed visual descriptions (clothing, hair, facial features, age, ethnicity) for them. These descriptions will be used to maintain character consistency throughout the storyboard. If the user's prompt mentions characters, map them to the people in the image." : ""}

Evaluate the prompt based on these parameters:
1. Title: Suggest a fitting title.
2. Number of Characters: Identify or suggest the number of characters.
3. Number of Scenes: Suggest an optimal number of scenes.
4. Objective: What is the core objective of this story?
5. Message: What is the underlying message or theme?
6. Copyright Check: Check if the prompt explicitly requests copyrighted characters, franchises, or specific intellectual property (e.g., Batman, Mickey Mouse, Harry Potter, Star Wars). If it does, set 'isCopyrighted' to true and provide a 'copyrightReason'.

Also, check if the user explicitly provided: Story Title, Number of Characters, Number of Scenes, Number of Frames, Camera Angles, Lighting, and Lens Attributes.
If the user's prompt is missing these key ingredients, classify it as "average" or "weak".
If the prompt contains copyrighted material, you MUST classify it as "weak", set 'isCopyrighted' to true, and ensure all 'suggestions' replace the copyrighted elements with generic, original equivalents.

Check for consistency between these parameters and the crux of the story.

Classify it as "good", "average", or "weak".
If it is "average" or "weak":
1. Provide a "guide" that lists the missing elements, explains the ingredients of a perfect storyboard prompt, and gives a short example of a good prompt.
2. Provide up to 3 improved versions of the prompt that add necessary details (character appearance, setting, mood, style, camera angles, lighting, lens attributes) for a better storyboard. CRITICAL: Each suggested prompt MUST be strictly under 3000 characters in length.
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

  const response = await ai.models.generateContent({
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
}

export async function planStoryboard(prompt: string, numScenes: number, framesPerScene: number, existingCharacters: any[] = [], image?: { mimeType: string; data: string } | null) {
  const cacheKey = `plan_${hashString(prompt + numScenes + framesPerScene + JSON.stringify(existingCharacters) + (image ? "with_image" : ""))}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  const contents: any[] = [
    {
      text: `You are the "Storyboard Brain," a collaborative team of world-class film professionals working together to create a production-ready storyboard.

THE CREATIVE TEAM:
1. STORY SUPERVISOR: Ensures the narrative arc is tight, emotionally resonant, and strictly follows the user's prompt without hallucinations.
2. DIRECTOR: Defines the overall vision, character expressions, and emotional beats.
3. CINEMATOGRAPHER & CAMERAMAN: Chooses the precise camera angles, lens types (e.g., 35mm, 85mm), and framing (e.g., extreme close-up, wide shot) to tell the story visually.
4. LIGHTING DIRECTOR: Designs the global and local lighting to enhance the mood, using specific techniques (e.g., Rembrandt lighting, high-key, rim lighting).

PROJECT PARAMETERS:
Prompt: "${prompt}"
Number of Scenes: ${numScenes}
Frames per Scene: ${framesPerScene}

CRITICAL COPYRIGHT RULE: You MUST NOT use or reference copyrighted characters, franchises, or specific intellectual property (e.g., Marvel, Disney, Star Wars). If the prompt contains them, you MUST adapt them into generic, original equivalents.

${image ? "CRITICAL: A reference image has been provided. The team MUST use the characters and visual style from this image as the primary reference." : ""}
${existingCharacters.length > 0 ? `Use these existing characters: ${existingCharacters.map(c => `${c.name} (${c.visualDescription})`).join(", ")}.` : ""}

WORKFLOW:
1. The Story Supervisor identifies the core narrative arc and crux.
2. The team decomposes the story into ${numScenes} logical scenes and ${framesPerScene} frames per scene.
3. The team maintains strict consistency of characters and environments.
4. The Director, Cinematographer, and Lighting Director collaborate on every single frame.

VISUAL STYLE MANIFEST:
- Primary Style: Cinematic 3D Animation (e.g., Pixar/Disney style).
- Lighting Model: Global warm sunlight (5500K) with soft ray-traced shadows.
- Texture Constraint: Consistent "Subsurface Scattering" on skin and fur.
- Anti-Drift Rule: Maintain depth, material gloss, and shadow softness.
- Atmospheric Consistency: Constant 5% "Volume Fog".

For each frame, provide:
- Caption: 1-line description of the action.
- Image Prompt: Detailed prompt for the image generator.
- Camera Intent: Precise placement and lens choice.
- Lighting Intent: Specific lighting setup for the frame.
- Character Expression: Emotional state and facial cues (maintaining anatomy).
- Cinematography Notes: Professional notes on composition and framing.

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

  const response = await ai.models.generateContent({
    model: "gemini-3.1-pro-preview",
    contents: { parts: contents },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
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
                      cinematographyNotes: { type: Type.STRING },
                    },
                    required: ["frameNumber", "caption", "imagePrompt", "cameraIntent", "lightingIntent", "characterExpression", "cinematographyNotes"],
                  },
                },
              },
              required: ["sceneNumber", "setting", "frames"],
            },
          },
        },
        required: ["title", "storySummary", "artStyle", "ambience", "characters", "scenes"],
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
}

export async function generateFrameImage(
  imagePrompt: string, 
  sampleImage?: { mimeType: string; data: string } | null,
  aspectRatio: "16:9" | "9:16" | "1:1" = "16:9",
  referenceType: "character" | "composition" | "scene_consistency" = "character"
) {
  let referenceText = "";
  if (sampleImage) {
    if (referenceType === "composition") {
      referenceText = "CRITICAL: Use the provided image as a strict structural and composition reference. Maintain the EXACT SAME character poses, facial expressions, background objects, and overall layout. ONLY alter the lighting or camera angle as requested in the prompt. ";
    } else if (referenceType === "scene_consistency") {
      referenceText = "CRITICAL: Use the provided image as a strict reference for BOTH character identity AND background environment. The characters' actions and poses should change according to the prompt, but their facial features, clothing, and the entire background architecture/landscape MUST remain identical to the provided image. ";
    } else {
      referenceText = "CRITICAL: Use the provided image as a strict visual reference for character identity, facial features, and clothing. ";
    }
  }

  const parts: any[] = [
    {
      text: referenceText + imagePrompt + " Ensure there are NO watermarks, NO logos, NO signatures, NO text, and NO copyrighted characters or intellectual property in the image. Use generic, original designs only. CRITICAL: Strictly adhere to any camera angles, lighting, or lens attributes specified in the prompt. CHARACTER CONSISTENCY RULE: Maintain the exact jawline, facial anatomy, and body structure of the characters as established in the reference. Only change their emotional expressions and poses as directed.",
    },
  ];

  if (sampleImage) {
    parts.unshift({
      inlineData: {
        data: sampleImage.data,
        mimeType: sampleImage.mimeType,
      },
    });
  }

  const response = await ai.models.generateContent({
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
}
