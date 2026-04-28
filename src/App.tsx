import React, { useState, useRef } from "react";
import {
  analyzePrompt,
  planStoryboard,
  generateFrameImage,
} from "./lib/gemini";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { Card, CardContent, CardFooter } from "./components/ui/card";
import { Label } from "./components/ui/label";
import {
  Loader2,
  RefreshCw,
  Image as ImageIcon,
  Check,
  AlertCircle,
  Upload,
  X,
  Play,
  Pause,
  Plus,
  Minus,
  LayoutTemplate,
  MessageSquare,
  Video,
  ArrowRight,
  Download,
  FileArchive,
  FileSpreadsheet,
  Settings2,
  DownloadCloud,
  ShieldAlert,
  Shirt,
  Layout,
  MonitorStop,
  User,
  MapPin,
  Menu,
  Moon,
  Sun,
  Sparkles,
} from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { motion, AnimatePresence } from "motion/react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "./components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "./components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import {
  processImage,
  downloadBlob,
  createZip,
  exportToCSV,
  exportToPDF,
} from "./lib/imageUtils";
type Frame = {
  frameNumber: number;
  caption: string;
  narrativeBeat?: string;
  imagePrompt: string;
  cameraIntent?: string;
  lightingIntent?: string;
  characterExpression?: string;
  makeupAndHairDetail?: string;
  costumeDesign?: string;
  cinematographyNotes?: string;
  sceneDirectorNotes?: string;
  imageUrl?: string;
  status: "pending" | "generating" | "completed" | "error";
  errorMessage?: string;
  camera?: string;
  lighting?: string;
};
type Character = { name: string; visualDescription: string };
type Scene = {
  sceneNumber: number;
  setting: string;
  description?: string;
  frames: Frame[];
};
type AppState =
  | "idle"
  | "analyzing"
  | "needs_improvement"
  | "planning"
  | "ready";
type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "custom";
type Resolution = "original" | "720p" | "1080p" | "4k";
const STORY_STYLES = [
  {
    id: "Cinematic Realistic",
    label: "Cinematic Realistic",
    desc: "High-end 3D, natural lighting, realistic textures",
  },
  {
    id: "3D Cartoon",
    label: "3D Cartoon",
    desc: "Pixar/Disney style, expressive, stylized proportions",
  },
  {
    id: "Anime / Avatar",
    label: "Anime / Avatar",
    desc: "2D/3D Anime style, vibrant colors, stylized shading",
  },
  {
    id: "Photorealistic Human",
    label: "Photorealistic Human",
    desc: "Live-action movie, real human actors, photographic",
  },
  {
    id: "Stylized Mix",
    label: "Stylized Mix",
    desc: "Spider-Verse style, comic-book elements, mixed media",
  },
];
export default function App() {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [sampleImage, setSampleImage] = useState<{
    url: string;
    mimeType: string;
    data: string;
  } | null>(null);
  const [backgroundReferenceImage, setBackgroundReferenceImage] = useState<{
    url: string;
    mimeType: string;
    data: string;
  } | null>(null);
  const [numScenes, setNumScenes] = useState(2);
  const [framesPerScene, setFramesPerScene] = useState(3);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [customAspectRatio, setCustomAspectRatio] = useState("21:9");
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [storyStyle, setStoryStyle] = useState<string>("Cinematic Realistic");
  const [directorStyle, setDirectorStyle] = useState<string>("Standard");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isDownloading, setIsDownloading] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [currentPreviewFrameIndex, setCurrentPreviewFrameIndex] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(true);
  const [skipAnalysisForCurrentPrompt, setSkipAnalysisForCurrentPrompt] =
    useState(false);
  const [regeneratingFrame, setRegeneratingFrame] = useState<{
    sceneIndex: number;
    frameIndex: number;
  } | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string>("Default");
  const [selectedLighting, setSelectedLighting] = useState<string>("Default");
  const [progress, setProgress] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState("");
  const [sceneProgress, setSceneProgress] = useState<{ [key: number]: number }>(
    {},
  );
  const [downloadProgress, setDownloadProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);

  const [suggestions, setSuggestions] = useState<
    {
      prompt: string;
      explanation: string;
      scenes: number;
      framesPerScene: number;
      characters: string[];
    }[]
  >([]);
  const [suggestedFrames, setSuggestedFrames] = useState<number | null>(null);
  const [suggestedScenesCount, setSuggestedScenesCount] = useState<
    number | null
  >(null);
  const [analysis, setAnalysis] = useState<{
    title: string;
    numCharacters: number;
    numScenes: number;
    objective: string;
    message: string;
    consistencyCheck: string;
  } | null>(null);
  const [guide, setGuide] = useState<{
    missingElements: string[];
    ingredients: string;
    example: string;
  } | null>(null);
  const [identifiedCharacters, setIdentifiedCharacters] = useState<Character[]>(
    [],
  );
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  const hasAllIngredients = (p: string) => {
    const lower = p.toLowerCase();
    const hasScenes = lower.includes("scene") || lower.includes("setting");
    const hasCamera =
      lower.includes("camera") ||
      lower.includes("angle") ||
      lower.includes("lens");
    const hasDirector =
      lower.includes("director") ||
      lower.includes("note") ||
      lower.includes("intent");
    const hasLighting =
      lower.includes("lighting") ||
      lower.includes("shadow") ||
      lower.includes("mood");
    return hasScenes && hasCamera && hasDirector && hasLighting;
  };
  const [storyboard, setStoryboard] = useState<{
    title: string;
    storyTreatment?: string;
    storySummary: string;
    artStyle: string;
    selectedStyle: string;
    ambience: string;
    characters: Character[];
    scenes: Scene[];
    aspectRatio: AspectRatio;
  } | null>(null);

  const allCompletedFrames = React.useMemo(() => {
    if (!storyboard) return [];
    return storyboard.scenes.flatMap((scene) => 
      scene.frames
        .filter((f) => f.status === "completed" && f.imageUrl)
        .map(f => ({ ...f, sceneSetting: scene.setting }))
    );
  }, [storyboard]);

  React.useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isPreviewOpen && previewPlaying && allCompletedFrames.length > 0) {
      interval = setInterval(() => {
        setCurrentPreviewFrameIndex((prev) => 
          (prev + 1) % allCompletedFrames.length
        );
      }, 3000); // 3 seconds per frame
    }
    return () => clearInterval(interval);
  }, [isPreviewOpen, previewPlaying, allCompletedFrames.length]);
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    type: "character" | "background",
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64Data = result.split(",")[1];
      const imgObj = { url: result, mimeType: file.type, data: base64Data };
      if (type === "character") {
        setSampleImage(imgObj);
      } else {
        setBackgroundReferenceImage(imgObj);
      }
    };
    reader.readAsDataURL(file);
  };
  const handleAnalyze = async () => {
    if (!prompt.trim()) {
      toast.error("Please enter a prompt.");
      return;
    }
    if (prompt.length > 3000) {
      toast.error("Prompt is too long. Please keep it under 3000 characters.");
      return;
    }
    if (aspectRatio === "custom" && !/^\d+:\d+$/.test(customAspectRatio)) {
      toast.error(
        "Invalid custom aspect ratio format. Please use W:H (e.g., 21:9).",
      );
      return;
    }
    if (numScenes < 1 || numScenes > 10) {
      toast.error("Number of scenes must be between 1 and 10.");
      return;
    }
    if (framesPerScene < 1 || framesPerScene > 10) {
      toast.error("Frames per scene must be between 1 and 10.");
      return;
    }
    if (skipAnalysisForCurrentPrompt || hasAllIngredients(prompt)) {
      setSkipAnalysisForCurrentPrompt(false);
      handlePlan(prompt, identifiedCharacters);
      return;
    }
    setAppState("analyzing");
    setProgress(0);
    setLoadingMessage("Analyzing prompt quality...");
    const messages = [
      "Analyzing prompt quality...",
      "Identifying characters...",
      "Checking for copyright compliance...",
      "Evaluating narrative structure...",
      "Finalizing analysis...",
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMessage(messages[msgIdx]);
    }, 2000);
    const progInterval = setInterval(() => {
      setProgress((prev) => {
        const remaining = 99 - prev;
        const increment = Math.max(0.15, remaining * 0.05 * Math.random());
        return prev < 99 ? prev + increment : 99;
      });
    }, 300);
    try {
      const analyzePromise = analyzePrompt(prompt, sampleImage);
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Analysis timed out. Please try again.")),
          300000,
        ),
      );
      const result = (await Promise.race([
        analyzePromise,
        timeoutPromise,
      ])) as any;
      clearInterval(msgInterval);
      clearInterval(progInterval);
      setProgress(100);
      if (!result) {
        throw new Error("Failed to parse analysis result.");
      }
      if (result.isCopyrighted) {
        toast.error(
          "Copyrighted material detected. Please use original concepts.",
        );
        setSuggestions(result.suggestions || []);
        setAnalysis(result.analysis || null);
        setGuide({
          missingElements: ["Original Characters/Story"],
          ingredients:
            "Originality is key! To comply with copyright policies, we cannot generate protected intellectual property.",
          example:
            result.copyrightReason ||
            "Instead of 'Batman', try 'A dark, brooding vigilante detective'.",
        });
        setAppState("needs_improvement");
        return;
      }
      if (result.analysis) {
        setAnalysis(result.analysis);
        if (result.analysis.numScenes)
          setSuggestedScenesCount(result.analysis.numScenes);
      } else {
        setAnalysis(null);
      }
      if (result.guide) setGuide(result.guide);
      else setGuide(null);
      if (result.identifiedCharacters) {
        setIdentifiedCharacters(result.identifiedCharacters);
        setSelectedCharacters(
          result.identifiedCharacters.map((c: any) => c.name),
        );
      }
      if (result.status === "good") {
        handlePlan(prompt, result.identifiedCharacters);
      } else {
        setSuggestions(result.suggestions || []);
        setAppState("needs_improvement");
      }
    } catch (error: any) {
      clearInterval(msgInterval);
      clearInterval(progInterval);
      console.error(error);
      toast.error(error.message || "Failed to analyze prompt.");
      setAppState("idle");
    }
  };
  const getApiAspectRatio = (
    ratio: AspectRatio,
    customRatio: string,
  ): "16:9" | "9:16" | "1:1" | "4:3" | "3:4" => {
    if (ratio !== "custom") return ratio;

    // For custom, try to guess the closest standard ratio to minimize cropping loss
    const [w, h] = customRatio.split(":").map(Number);
    if (!w || !h) return "16:9";
    const val = w / h;
    if (val > 1.5) return "16:9";

    // e.g. 21:9
    if (val > 1.1) return "4:3";
    if (val > 0.9) return "1:1";
    if (val > 0.6) return "3:4";
    return "9:16";
  };
  const handlePlan = async (
    finalPrompt: string,
    charactersToUse: Character[] = identifiedCharacters,
  ) => {
    setPrompt(finalPrompt);
    setAppState("planning");
    setProgress(0);
    setLoadingMessage("Assembling pre-production team...");
    const messages = [
      "Assembling pre-production team...",
      "Script Writer finalizing narrative arc...",
      "Director setting the story treatment...",
      "Cinematographer planning camera angles...",
      "Lighting Director designing the mood...",
      "Costume Designer finalizing outfits...",
      "Assistant Director coordinating scenes...",
      "Production Designer building the set...",
      "Finalizing production bible...",
    ];
    let msgIdx = 0;
    const msgInterval = setInterval(() => {
      msgIdx = (msgIdx + 1) % messages.length;
      setLoadingMessage(messages[msgIdx]);
    }, 2500);
    const progInterval = setInterval(() => {
      setProgress((prev) => {
        const remaining = 99 - prev;
        const increment = Math.max(0.15, remaining * 0.04 * Math.random());
        return prev < 99 ? prev + increment : 99;
      });
    }, 400);
    try {
      const planPromise = planStoryboard(
        finalPrompt,
        numScenes,
        framesPerScene,
        charactersToUse,
        sampleImage,
        backgroundReferenceImage,
        storyStyle + " - Directed as " + directorStyle,
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error("Storyboard planning timed out. Please try again."),
            ),
          600000,
        ),
      );
      const plan = (await Promise.race([planPromise, timeoutPromise])) as any;
      clearInterval(msgInterval);
      clearInterval(progInterval);
      setProgress(100);
      const initialScenes: Scene[] = plan.scenes.map((scene: any) => ({
        ...scene,
        frames: scene.frames.map((f: any) => ({ ...f, status: "pending" })),
      }));
      setStoryboard({
        title: plan.title,
        storyTreatment: plan.storyTreatment,
        storySummary: plan.storySummary,
        artStyle: plan.artStyle,
        selectedStyle: storyStyle,
        ambience: plan.ambience || "Standard lighting and mood.",
        characters: plan.characters || [],
        scenes: initialScenes,
        aspectRatio: aspectRatio,
      });
      setAppState("ready");
    } catch (error: any) {
      clearInterval(msgInterval);
      clearInterval(progInterval);
      console.error(error);
      toast.error(error.message || "Failed to plan storyboard.");
      setAppState("idle");
    }
  };
  const handleGenerateScene = async (sceneIndex: number) => {
    if (!storyboard) return;
    setStoryboard((prev) => {
      if (!prev) return prev;
      const newScenes = [...prev.scenes];
      newScenes[sceneIndex] = {
        ...newScenes[sceneIndex],
        frames: newScenes[sceneIndex].frames.map((f) => ({
          ...f,
          status: "generating",
          errorMessage: undefined,
        })),
      };
      return { ...prev, scenes: newScenes };
    });
    const apiRatio = getApiAspectRatio(
      storyboard.aspectRatio,
      customAspectRatio,
    );
    const scene = storyboard.scenes[sceneIndex];
    const characterContext = storyboard.characters
      .map((c) => `${c.name}: ${c.visualDescription}`)
      .join(" | ");
    // Sequential Bridge Consistency: Try to find the last image of the previous scene to serve as the visual "Bridge"
    let bridgeImage: { mimeType: string; data: string } | null = null;
    if (sceneIndex > 0) {
      const prevScene = storyboard.scenes[sceneIndex - 1];
      for (let i = prevScene.frames.length - 1; i >= 0; i--) {
        const lastImg = prevScene.frames[i].imageUrl;
        if (lastImg) {
          const match = lastImg.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            bridgeImage = { mimeType: match[1], data: match[2] };
            break;
          }
        }
      }
    }

    let firstFrameImage: { mimeType: string; data: string } | null = null;
    const totalFrames = scene.frames.length;
    setSceneProgress((prev) => ({ ...prev, [sceneIndex]: 0 }));
    for (let frameIndex = 0; frameIndex < scene.frames.length; frameIndex++) {
      const frame = scene.frames[frameIndex];
      try {
        const selectedStyleDetails =
          STORY_STYLES.find((s) => s.id === storyboard.selectedStyle)?.desc ||
          "";
        
        // Removed hardcoded 'Global warm sunlight' that was killing emotional mood. 
        // We now rely purely on the Director's output from the planning phase for lighting/mood.
        const styleManifest = `[VISUAL STYLE MANIFEST] Primary Style Directive: ${storyboard.selectedStyle}. Style Details: ${selectedStyleDetails}. Art Style Details: ${storyboard.artStyle}.`;
        const backgroundConsistency = `BACKGROUND CONSISTENCY: The background architecture, landscape, and object placement MUST remain consistent with the Scene Setting.`;
        const directorIntent = `[MANDATORY DIRECTOR'S INSTRUCTIONS] You MUST follow these to the letter:\n- Camera Intent: ${frame.cameraIntent || "Professional cinematography"}\n- Lighting: ${frame.lightingIntent || "Cinematic lighting"}\n- Character Expression: ${frame.characterExpression || "Natural and story-aligned"}\n- Costume Design: ${frame.costumeDesign || "Consistent character attire"}\n- Cinematography Notes: ${frame.cinematographyNotes || "Balanced composition"}`;
        const narrativeTimingRule = `CRITICAL NARRATIVE TIMING: Render EXACTLY what is happening in the current Action. Do NOT jump ahead in the plot or add elements from the overall Ambience if they conflict with the peacefulness or specificity of the current frame.`;
        const microPhysicsRule = `[REALITY ENGINE ACTIVE] Apply Micro-Physics & Imperfection: Force organic camera drift (1-3° tilt), asymmetric framing, and atmospheric chaos (dust/haze). Subtly render secondary reactions (fabric tension, skin compression) without altering the Director's composition. Eliminate AI perfection.`;
        const fullPrompt = `${styleManifest}\n${backgroundConsistency}\n\n${directorIntent}\n\nAmbience/Mood: ${storyboard.ambience}.\nScene Setting: ${scene.setting}.\nCharacters: ${characterContext}.\n\nPrimary Action to Render: ${frame.imagePrompt}.\n\n${narrativeTimingRule}\n${microPhysicsRule}\n[MANDATORY CINEMATOGRAPHY & REALISM CHECK] Ensure atmospheric matching. The environment MUST NOT be static. Include reactive environmental storytelling: dynamic dust, debris, fog, or focus blur.`;
        
        // ALWAYS use the user's original sampleImage to maintain absolute 100% identity lock.
        // Replacing it with generated frames causes rapid genetic drift across scenes.
        let referenceImage = sampleImage;
        let refType: "character" | "composition" | "scene_consistency" = "character";

        const generatePromise = generateFrameImage(
          fullPrompt,
          referenceImage,
          backgroundReferenceImage,
          apiRatio as any,
          refType,
          storyboard.selectedStyle,
        );
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error("Image generation timed out.")),
            120000,
          ),
        );
        const imageUrl = (await Promise.race([
          generatePromise,
          timeoutPromise,
        ])) as string;
        if (frameIndex === 0 && imageUrl) {
          const match = imageUrl.match(
            /^data:(image\/[a-zA-Z+]+);base64,(.+)$/,
          );
          if (match) {
            firstFrameImage = { mimeType: match[1], data: match[2] };
          }
        }
        setStoryboard((prev) => {
          if (!prev) return prev;
          const newScenes = [...prev.scenes];
          const newFrames = [...newScenes[sceneIndex].frames];
          newFrames[frameIndex] = {
            ...newFrames[frameIndex],
            imageUrl,
            status: "completed",
          };
          newScenes[sceneIndex] = {
            ...newScenes[sceneIndex],
            frames: newFrames,
          };
          return { ...prev, scenes: newScenes };
        });
        setSceneProgress((prev) => ({
          ...prev,
          [sceneIndex]: ((frameIndex + 1) / totalFrames) * 100,
        }));

        // Add a small delay between requests to help avoid rate limits
        if (frameIndex < scene.frames.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`Failed to generate frame ${frame.frameNumber}`, error);
        setStoryboard((prev) => {
          if (!prev) return prev;
          const newScenes = [...prev.scenes];
          const newFrames = [...newScenes[sceneIndex].frames];
          newFrames[frameIndex] = {
            ...newFrames[frameIndex],
            status: "error",
            errorMessage: error.message || "Unknown error",
          };
          newScenes[sceneIndex] = {
            ...newScenes[sceneIndex],
            frames: newFrames,
          };
          return { ...prev, scenes: newScenes };
        });
      }
    }

    // Clear progress after a delay
    setTimeout(() => {
      setSceneProgress((prev) => {
        const next = { ...prev };
        delete next[sceneIndex];
        return next;
      });
    }, 3000);
  };
  const handleRegenerateFrame = async (
    sceneIndex: number,
    frameIndex: number,
    cameraControl?: string,
    lightingControl?: string,
  ) => {
    if (!storyboard) return;

    // Use provided controls or fall back to current frames controls or "Default"
    const currentFrame = storyboard.scenes[sceneIndex].frames[frameIndex];
    const finalCamera = cameraControl || currentFrame.camera || "Default";
    const finalLighting = lightingControl || currentFrame.lighting || "Default";
    setStoryboard((prev) => {
      if (!prev) return prev;
      const newScenes = [...prev.scenes];
      const newFrames = [...newScenes[sceneIndex].frames];
      newFrames[frameIndex] = {
        ...newFrames[frameIndex],
        status: "generating",
        imageUrl: undefined,
        errorMessage: undefined,
        camera: finalCamera,
        lighting: finalLighting,
      };
      newScenes[sceneIndex] = { ...newScenes[sceneIndex], frames: newFrames };
      return { ...prev, scenes: newScenes };
    });
    const apiRatio = getApiAspectRatio(
      storyboard.aspectRatio,
      customAspectRatio,
    );
    const scene = storyboard.scenes[sceneIndex];
    const frame = scene.frames[frameIndex];
    const characterContext = storyboard.characters
      .map((c) => `${c.name}: ${c.visualDescription}`)
      .join(" | ");
    const cameraContext =
      finalCamera !== "Default"
        ? `Camera: ${finalCamera}. `
        : frame.cameraIntent
          ? `Camera Intent: ${frame.cameraIntent}. `
          : "";
    const lightingContext =
      finalLighting !== "Default"
        ? `Lighting: ${finalLighting}. IMPORTANT: Change the shape, size, and direction of shadows of the characters to match this new lighting perfectly. Maintain strict consistency among characters, background, accessories, hair style, and everything else available in the frame. `
        : frame.lightingIntent
          ? `Lighting Intent: ${frame.lightingIntent}. `
          : "";
    const expressionContext = frame.characterExpression
      ? `Character Expression: ${frame.characterExpression}. `
      : "";
    const costumeContext = frame.costumeDesign
      ? `Costume Design: ${frame.costumeDesign}. `
      : "";
    const cinematographyContext = frame.cinematographyNotes
      ? `Cinematography Notes: ${frame.cinematographyNotes}. `
      : "";
    const selectedStyleDetails =
      STORY_STYLES.find((s) => s.id === storyboard.selectedStyle)?.desc || "";
      
    // Removed hardcoded 'Global warm sunlight' that was killing emotional mood during regeneration.
    const styleManifest = `[VISUAL STYLE MANIFEST] Primary Style Directive: ${storyboard.selectedStyle}. Style Details: ${selectedStyleDetails}. Art Style Details: ${storyboard.artStyle}.`;
    
    const directorIntent = `[MANDATORY DIRECTOR'S INSTRUCTIONS] You MUST follow these to the letter:\n- ${cameraContext}\n- ${lightingContext}\n- ${expressionContext}\n- ${costumeContext}\n- ${cinematographyContext}`;
    const narrativeTimingRule = `CRITICAL NARRATIVE TIMING: Render EXACTLY what is happening in the current Action. Do NOT jump ahead in the plot or add elements from the overall Ambience if they conflict with the current frame.`;
    const microPhysicsRule = `[REALITY ENGINE ACTIVE] Apply Micro-Physics & Imperfection: Force organic camera drift (1-3° tilt), asymmetric framing, and atmospheric chaos (dust/haze). Subtly render secondary reactions (fabric tension, skin compression) without altering the Director's composition. Eliminate AI perfection.`;
    const integrationRule = '[MANDATORY CINEMATOGRAPHY & REALISM CHECK] Generate a cinematic frame with authentic lens interaction, depth of field, and ambient atmosphere reflecting the emotional mood. No plastic AI rendering.';
    
    const fullPrompt = `${styleManifest}\n\nAmbience/Mood: ${storyboard.ambience}.\nScene Setting: ${scene.setting}.\nCharacters: ${characterContext}.\n\n${directorIntent}\n\nPrimary Action to Render: ${frame.imagePrompt}.\n\n${narrativeTimingRule}\n${microPhysicsRule}\n${integrationRule}`;
    
    // ALWAYS pull identity from the pristine sampleImage to fix character drift on regeneration
    let referenceImage = sampleImage;
    let refType: "character" | "composition" = "character";
    
    try {
      const generatePromise = generateFrameImage(
        fullPrompt,
        referenceImage,
        backgroundReferenceImage,
        apiRatio as any,
        refType,
        storyboard.selectedStyle,
      );
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error("Image generation timed out.")),
          120000,
        ),
      );
      const imageUrl = (await Promise.race([
        generatePromise,
        timeoutPromise,
      ])) as string;
      setStoryboard((prev) => {
        if (!prev) return prev;
        const newScenes = [...prev.scenes];
        const newFrames = [...newScenes[sceneIndex].frames];
        newFrames[frameIndex] = {
          ...newFrames[frameIndex],
          imageUrl,
          status: "completed",
        };
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], frames: newFrames };
        return { ...prev, scenes: newScenes };
      });
    } catch (error: any) {
      console.error(`Failed to regenerate frame ${frame.frameNumber}`, error);
      setStoryboard((prev) => {
        if (!prev) return prev;
        const newScenes = [...prev.scenes];
        const newFrames = [...newScenes[sceneIndex].frames];
        newFrames[frameIndex] = {
          ...newFrames[frameIndex],
          status: "error",
          errorMessage: error.message || "Unknown error",
        };
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], frames: newFrames };
        return { ...prev, scenes: newScenes };
      });
      toast.error(`Failed to regenerate frame ${frame.frameNumber}`);
    }
  };
  const handleDownloadFrame = async (
    frame: Frame,
    format: "png" | "jpeg" = "png",
  ) => {
    if (!frame.imageUrl) return;
    try {
      setIsDownloading(true);
      toast.info(`Preparing frame ${frame.frameNumber} for download...`);
      const exportRatio = aspectRatio === "custom" ? customAspectRatio : aspectRatio;
      const { blob } = await processImage(
        frame.imageUrl,
        resolution,
        exportRatio,
        format,
      );
      downloadBlob(blob, `storyboard-frame-${frame.frameNumber}.${format}`);
      toast.success(`Frame ${frame.frameNumber} downloaded!`);
    } catch (error) {
      console.error(error);
      toast.error("Failed to download frame.");
    } finally {
      setIsDownloading(false);
    }
  };
  const handleDownloadPDF = async () => {
    if (!storyboard) return;
    const totalFrames = storyboard.scenes.reduce(
      (acc, s) => acc + s.frames.length,
      0,
    );
    const completedFrames = storyboard.scenes.reduce(
      (acc, s) => acc + s.frames.filter((f) => f.status === "completed").length,
      0,
    );
    if (completedFrames === 0) {
      toast.error("No completed frames to include in PDF.");
      return;
    }
    if (completedFrames < totalFrames) {
      toast.warning(
        `Note: Only ${completedFrames} of ${totalFrames} frames are generated. The PDF will have missing images.`,
      );
    }
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      toast.info("Preparing storyboard PDF file...");
      const exportRatio = aspectRatio === "custom" ? customAspectRatio : aspectRatio;
      const pdfBlob = await exportToPDF(
        storyboard,
        {
          originalPrompt: prompt,
          hasCharacterReference: !!sampleImage,
          hasBackgroundReference: !!backgroundReferenceImage,
          selectedStyle: storyboard.selectedStyle
        },
        resolution,
        exportRatio,
        (p) => setDownloadProgress(p),
      );
      downloadBlob(
        pdfBlob,
        `${storyboard.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-storyboard.pdf`,
      );
      toast.success("Storyboard PDF downloaded successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create PDF file.");
    } finally {
      setIsDownloading(false);
    }
  };
  const handleDownloadAll = async () => {
    if (!storyboard) return;
    try {
      setIsDownloading(true);
      setDownloadProgress(0);
      toast.info("Preparing storyboard ZIP file...");
      const files = [];
      const total = storyboard.scenes.reduce(
        (acc, s) => acc + s.frames.length,
        0,
      );
      let count = 0;
      const exportRatio = aspectRatio === "custom" ? customAspectRatio : aspectRatio;
      for (const scene of storyboard.scenes) {
        for (const frame of scene.frames) {
          if (frame.imageUrl && frame.status === "completed") {
            const { blob } = await processImage(
              frame.imageUrl,
              resolution,
              exportRatio,
              "png",
            );
            files.push({
              name: `scene-${scene.sceneNumber}-frame-${String(frame.frameNumber).padStart(2, "0")}.png`,
              blob,
            });
          }
          count++;
          setDownloadProgress((count / total) * 100);
        }
      }
      if (files.length === 0) {
        toast.error("No completed frames to download.");
        return;
      }
      const zipBlob = await createZip(files);
      downloadBlob(
        zipBlob,
        `${storyboard.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-storyboard.zip`,
      );
      toast.success("Storyboard downloaded successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create ZIP file.");
    } finally {
      setIsDownloading(false);
    }
  };
  const handleDownloadCSV = async () => {
    if (!storyboard) return;
    try {
      setIsDownloading(true);
      toast.info("Preparing CSV data for export...");
      const csvBlob = await exportToCSV(storyboard);
      downloadBlob(
        csvBlob,
        `${storyboard.title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}-metadata.csv`,
      );
      toast.success("CSV metadata exported successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to export CSV file.");
    } finally {
      setIsDownloading(false);
    }
  };
  const getAspectRatioClass = (ratio: AspectRatio) => {
    switch (ratio) {
      case "16:9":
        return "aspect-video";
      case "9:16":
        return "aspect-[9/16]";
      case "1:1":
        return "aspect-square";
      case "4:3":
        return "aspect-[4/3]";
      case "3:4":
        return "aspect-[3/4]";
      default:
        return "aspect-video";
    }
  };
  return (
    <div className="min-h-screen bg-[#f8f9fb] text-slate-900 font-sans pb-20 selection:bg-violet-100 selection:text-violet-900 flex">
      <Toaster position="top-center" theme="light" />

      {/* Desktop Sidebar */}
      <aside
        className={`fixed md:sticky top-0 h-screen bg-white border-r border-slate-200 z-50 transition-all duration-300 hidden md:flex flex-col shadow-sm ${sidebarOpen ? "w-64" : "w-20"}`}
      >
        <div className="h-16 flex items-center justify-between px-4 border-b border-slate-200">
          {sidebarOpen && (
            <div className="flex items-center gap-2 overflow-hidden">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shrink-0 shadow-sm">
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
              <span className="font-bold tracking-tight text-slate-900 whitespace-nowrap">
                Storyboard
              </span>
            </div>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="shrink-0 text-slate-500 hover:text-slate-900"
            title={sidebarOpen ? "Collapse sidebar" : "Expand sidebar"}
          >
            <Menu className="w-5 h-5" />
          </Button>
        </div>

        <nav className="p-4 flex-col gap-2 flex-1 flex overflow-y-auto mt-4">
          <div className="space-y-1 relative group">
            <Button
              variant="ghost"
              onClick={() => setAppState("idle")}
              className={`w-full justify-start ${sidebarOpen ? "px-4" : "px-0 justify-center"} ${appState === "idle" ? "bg-violet-50 text-violet-700 font-medium" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
            >
              <LayoutTemplate className="w-5 h-5 shrink-0" />
              {sidebarOpen && <span className="ml-3">Idea</span>}
            </Button>
            {!sidebarOpen && (
              <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                Idea / Prompt
              </div>
            )}
          </div>

          {(analysis || suggestions.length > 0) && (
            <div className="space-y-1 relative group">
              <Button
                variant="ghost"
                onClick={() => setAppState("needs_improvement")}
                className={`w-full justify-start ${sidebarOpen ? "px-4" : "px-0 justify-center"} ${appState === "needs_improvement" ? "bg-amber-50 text-amber-700 font-medium" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                <AlertCircle className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span className="ml-3">Analysis</span>}
              </Button>
              {!sidebarOpen && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  Analysis
                </div>
              )}
            </div>
          )}

          {storyboard && (
            <div className="space-y-1 relative group">
              <Button
                variant="ghost"
                onClick={() => setAppState("ready")}
                className={`w-full justify-start ${sidebarOpen ? "px-4" : "px-0 justify-center"} ${appState === "ready" ? "bg-violet-50 text-violet-700 font-medium" : "text-slate-600 hover:text-slate-900 hover:bg-slate-50"}`}
              >
                <Layout className="w-5 h-5 shrink-0" />
                {sidebarOpen && <span className="ml-3">Storyboard</span>}
              </Button>
              {!sidebarOpen && (
                <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity whitespace-nowrap z-50">
                  Storyboard
                </div>
              )}
            </div>
          )}
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 transition-all">
        <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
            <div className="flex items-center gap-3 md:hidden">
              <div className="w-8 h-8 rounded-lg bg-violet-600 flex items-center justify-center shadow-sm">
                <ImageIcon className="w-4 h-4 text-white" />
              </div>
              <h1 className="text-lg font-bold tracking-tight text-slate-900 decoration-slate-200">
                Storyboard
              </h1>
            </div>

            {/* Desktop header title when sidebar is collapsed or not full width */}
            <div className="hidden md:flex items-center">
              {/* Optional page context could go here */}
            </div>

            <div className="flex items-center gap-2 md:hidden">
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button variant="ghost" size="icon" className="rounded-lg">
                      <Menu className="w-6 h-6 text-slate-700" />
                    </Button>
                  }
                />
                <DropdownMenuContent
                  align="end"
                  className="w-56 bg-white border border-slate-200 text-slate-900 rounded-xl shadow-xl mt-2 p-2"
                >
                  <DropdownMenuItem
                    onClick={() => setAppState("idle")}
                    className="hover:bg-slate-50 hover:text-slate-950 rounded-lg focus:bg-slate-100 py-3 cursor-pointer mb-1"
                  >
                    <LayoutTemplate className="w-4 h-4 mr-3 text-slate-500" />
                    <span className="font-medium">Idea</span>
                  </DropdownMenuItem>
                  {(analysis || suggestions.length > 0) && (
                    <DropdownMenuItem
                      onClick={() => setAppState("needs_improvement")}
                      className="hover:bg-slate-50 hover:text-slate-950 rounded-lg focus:bg-slate-100 py-3 cursor-pointer mb-1"
                    >
                      <AlertCircle className="w-4 h-4 mr-3 text-amber-500" />
                      <span className="font-medium">Analysis</span>
                    </DropdownMenuItem>
                  )}
                  {storyboard && (
                    <DropdownMenuItem
                      onClick={() => setAppState("ready")}
                      className="hover:bg-slate-50 hover:text-slate-950 rounded-lg focus:bg-slate-100 py-3 cursor-pointer"
                    >
                      <Layout className="w-4 h-4 mr-3 text-violet-500" />
                      <span className="font-medium">Storyboard</span>
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="flex items-center gap-3 ml-auto">
            {" "}
            {appState === "ready" &&
              storyboard?.scenes.some((s) =>
                s.frames.some((f) => f.status === "completed"),
              ) && (
                <>
                  {" "}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (allCompletedFrames.length === 0) {
                        toast.error("Generate some frames first to see the preview.");
                        return;
                      }
                      setIsPreviewOpen(true);
                      setCurrentPreviewFrameIndex(0);
                      setPreviewPlaying(true);
                    }}
                    className="rounded-lg bg-white border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-950 shadow-sm transition-all mr-2"
                  >
                    {" "}
                    <Play className="w-4 h-4 mr-2 text-fuchsia-500" />{" "}
                    Live Preview{" "}
                  </Button>{" "}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadPDF}
                    disabled={isDownloading}
                    className="rounded-lg bg-white border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-950 shadow-sm transition-all"
                  >
                    {" "}
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin text-violet-400" />
                    ) : (
                      <DownloadCloud className="w-4 h-4 mr-2 text-violet-400" />
                    )}{" "}
                    Export PDF{" "}
                  </Button>{" "}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleDownloadCSV}
                    disabled={isDownloading}
                    className="rounded-lg bg-white border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-950 shadow-sm transition-all"
                  >
                    {" "}
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin text-emerald-400" />
                    ) : (
                      <FileSpreadsheet className="w-4 h-4 mr-2 text-emerald-400" />
                    )}{" "}
                    Export CSV{" "}
                  </Button>{" "}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleDownloadAll}
                    disabled={isDownloading}
                    className="rounded-lg bg-violet-600 hover:bg-violet-500 text-slate-900 shadow-md shadow-violet-900/20 transition-all"
                  >
                    {" "}
                    {isDownloading ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <FileArchive className="w-4 h-4 mr-2" />
                    )}{" "}
                    Download ZIP{" "}
                  </Button>{" "}
                </>
              )}{" "}
            {appState === "ready" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setAppState("idle");
                  setPrompt("");
                  setSampleImage(null);
                  setStoryboard(null);
                }}
                className="rounded-lg bg-slate-50/50 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-all"
              >
                {" "}
                New Storyboard{" "}
              </Button>
            )}{" "}
          </div>{" "}
        </div>{" "}
      </header>{" "}
      <main className="max-w-5xl mx-auto px-4 py-8">
        {" "}
        <AnimatePresence mode="wait">
          {" "}
          {appState === "idle" && (
            <motion.div
              key="idle"
              initial={{ opacity: 0, y: 30, filter: "blur(10px)" }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="max-w-2xl mx-auto space-y-8"
            >
              {" "}
              <div className="text-center space-y-4">
                {" "}
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{
                    delay: 0.1,
                    type: "spring",
                    stiffness: 200,
                    damping: 20,
                  }}
                  className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-violet-500/10 border border-violet-500/20 text-violet-600 text-xs font-semibold uppercase tracking-widest mb-2"
                >
                  {" "}
                  <span className="relative flex h-2 w-2">
                    {" "}
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-lg bg-violet-400 opacity-75"></span>{" "}
                    <span className="relative inline-flex rounded-lg h-2 w-2 bg-violet-500"></span>{" "}
                  </span>{" "}
                  AI Pre-Production Suite{" "}
                </motion.div>{" "}
                <h2 className="text-4xl md:text-5xl font-bold tracking-tight text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 pb-2">
                  What's your story?
                </h2>{" "}
                <p className="text-slate-600 text-lg max-w-lg mx-auto">
                  Describe your scene, characters, and mood. We'll handle the
                  rest.
                </p>{" "}
              </div>{" "}
              <Card className="border-slate-200 shadow-sm shadow-violet-900/10 bg-white overflow-hidden rounded-2xl">
                {" "}
                <div className="h-1.5 flex w-full relative overflow-hidden">
                  {" "}
                  <div className="absolute inset-0 bg-gradient-to-r from-violet-500 via-fuchsia-500 to-indigo-500 opacity-70" />{" "}
                  <div className="absolute top-0 -left-[100%] h-full w-1/3 bg-white/40 blur-md animate-[shimmer_2s_infinite]" />{" "}
                </div>{" "}
                <CardContent className="p-8 space-y-8">
                  {" "}
                  <div className="space-y-3">
                    {" "}
                    <Label
                      htmlFor="prompt"
                      className="text-sm font-medium text-slate-700"
                    >
                      Story Prompt
                    </Label>{" "}
                    <div className="relative group">
                      {" "}
                      <div className="absolute -inset-0.5 bg-violet-600 hover:bg-violet-700 rounded-xl blur opacity-0 group-focus-within:opacity-30 transition duration-500"></div>{" "}
                      <Textarea
                        id="prompt"
                        placeholder="Paste your story idea here... Our pre-production team (Script Writer, Director, Cinematographer, etc.) will finalize it into a professional storyboard."
                        className="relative min-h-[140px] resize-none text-base bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-500 focus-visible:ring-1 focus-visible:ring-violet-500/50 pr-10 shadow-inner"
                        value={prompt}
                        maxLength={3000}
                        onChange={(e) => {
                          setPrompt(e.target.value);
                          setSkipAnalysisForCurrentPrompt(false);
                        }}
                      />{" "}
                      <div className="absolute bottom-3 right-3 flex items-center gap-2 pointer-events-none">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                            prompt.length > 2700
                              ? "bg-amber-50 text-amber-600 border-amber-200"
                              : "bg-slate-50 text-slate-400 border-slate-100"
                          } transition-colors tracking-tighter`}
                        >
                          {prompt.length} / 3000
                        </span>
                      </div>
                      {prompt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-3 right-3 h-8 w-8 text-slate-600 hover:text-slate-950 bg-white hover:bg-slate-700 rounded-lg transition-all"
                          onClick={() => {
                            setPrompt("");
                            setSkipAnalysisForCurrentPrompt(false);
                          }}
                          title="Clear prompt"
                        >
                          {" "}
                          <X className="h-4 w-4" />{" "}
                        </Button>
                      )}{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {" "}
                    <div className="space-y-3">
                      {" "}
                      <Label className="text-sm font-medium text-slate-700 shadow-sm">
                        Character Reference (Optional)
                      </Label>{" "}
                      <div className="flex items-center gap-4">
                        {" "}
                        {sampleImage ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="relative w-40 h-40 rounded-xl bg-slate-50 overflow-hidden border border-slate-200 shadow-md group"
                          >
                            {" "}
                            <img
                              src={sampleImage.url}
                              alt="Character Reference"
                              className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                            />{" "}
                            <button
                              onClick={() => setSampleImage(null)}
                              className="absolute top-2 right-2 bg-black/60 text-slate-900 rounded-lg p-1.5 hover:bg-rose-500 transition-colors z-10"
                            >
                              {" "}
                              <X className="w-3.5 h-3.5 text-white" />{" "}
                            </button>{" "}
                          </motion.div>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-40 h-40 flex-col rounded-xl border-dashed border-slate-200 text-slate-600 hover:text-slate-950 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all font-normal active:scale-[0.98]"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            {" "}
                            <User className="w-6 h-6 mb-2 text-violet-400" />{" "}
                            Upload Character{" "}
                          </Button>
                        )}{" "}
                        <input
                          type="file"
                          ref={fileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, "character")}
                        />{" "}
                      </div>{" "}
                      <p className="text-[11px] text-slate-500">
                        Upload an image to maintain character identity.
                      </p>{" "}
                    </div>{" "}
                    <div className="space-y-3">
                      {" "}
                      <Label className="text-sm font-medium text-slate-700">
                        Background Reference (Optional)
                      </Label>{" "}
                      <div className="flex items-center gap-4">
                        {" "}
                        {backgroundReferenceImage ? (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            className="relative w-40 h-40 rounded-xl bg-slate-50 overflow-hidden border border-slate-200 shadow-md group"
                          >
                            {" "}
                            <img
                              src={backgroundReferenceImage.url}
                              alt="Background Reference"
                              className="w-full h-full object-contain p-2 group-hover:scale-105 transition-transform duration-500"
                            />{" "}
                            <button
                              onClick={() => setBackgroundReferenceImage(null)}
                              className="absolute top-2 right-2 bg-black/60 text-slate-900 rounded-lg p-1.5 hover:bg-rose-500 transition-colors z-10"
                            >
                              {" "}
                              <X className="w-3.5 h-3.5 text-white" />{" "}
                            </button>{" "}
                          </motion.div>
                        ) : (
                          <Button
                            variant="outline"
                            className="w-40 h-40 flex-col rounded-xl border-dashed border-slate-200 text-slate-600 hover:text-slate-950 hover:border-violet-500/50 hover:bg-violet-500/5 transition-all font-normal active:scale-[0.98]"
                            onClick={() => bgFileInputRef.current?.click()}
                          >
                            {" "}
                            <MapPin className="w-6 h-6 mb-2 text-violet-400" />{" "}
                            Upload Background{" "}
                          </Button>
                        )}{" "}
                        <input
                          type="file"
                          ref={bgFileInputRef}
                          className="hidden"
                          accept="image/*"
                          onChange={(e) => handleImageUpload(e, "background")}
                        />{" "}
                      </div>{" "}
                      <p className="text-[11px] text-slate-500">
                        Upload a location reference (e.g., specific room).
                      </p>{" "}
                    </div>{" "}
                  </div>{" "}
                  <div className="flex items-start gap-3 mt-4 text-xs text-amber-800 bg-amber-50 p-4 rounded-xl border border-amber-200">
                    {" "}
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />{" "}
                    <p className="leading-relaxed">
                      Avoid using copyrighted characters or franchises (e.g.,
                      Marvel, Disney). The system adapts protected intellectual
                      property into generic concepts.
                    </p>{" "}
                  </div>{" "}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6 pt-4 items-end">
                    {" "}
                    <div className="space-y-3">
                      {" "}
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                        Art Style
                      </Label>{" "}
                      <Select value={storyStyle} onValueChange={setStoryStyle}>
                        {" "}
                        <SelectTrigger className="w-full h-11 bg-white border-slate-200 focus:ring-violet-500 rounded-xl transition-all hover:bg-slate-100">
                          {" "}
                          <SelectValue placeholder="Select style" />{" "}
                        </SelectTrigger>{" "}
                        <SelectContent className="bg-white border-slate-200 text-slate-900 rounded-xl shadow-sm">
                          {" "}
                          {STORY_STYLES.map((style) => (
                            <SelectItem
                              key={style.id}
                              value={style.id}
                              className="hover: focus:bg-slate-100 focus:text-slate-900 p-2 rounded-lg cursor-pointer"
                            >
                              {" "}
                              <div className="flex flex-col">
                                {" "}
                                <span className="font-semibold text-slate-900">
                                  {style.label}
                                </span>{" "}
                                <span className="text-[10px] text-slate-600 mt-0.5">
                                  {style.desc}
                                </span>{" "}
                              </div>{" "}
                            </SelectItem>
                          ))}{" "}
                        </SelectContent>{" "}
                      </Select>{" "}
                    </div>{" "}
                    <div className="space-y-3">
                      {" "}
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                        Director's Style
                      </Label>{" "}
                      <Select
                        value={directorStyle}
                        onValueChange={setDirectorStyle}
                      >
                        {" "}
                        <SelectTrigger className="w-full h-11 bg-white border-slate-200 focus:ring-violet-500 rounded-xl transition-all hover:bg-slate-100">
                          {" "}
                          <SelectValue placeholder="Select director" />{" "}
                        </SelectTrigger>{" "}
                        <SelectContent className="bg-white border-slate-200 text-slate-900 rounded-xl shadow-sm">
                          {" "}
                          <SelectItem
                            value="Standard"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            Standard Cinematic
                          </SelectItem>{" "}
                          <SelectItem
                            value="Film Noir"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            Film Noir (Dark, Gritty)
                          </SelectItem>{" "}
                          <SelectItem
                            value="Wes Anderson"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            Symmetrical & Pastel
                          </SelectItem>{" "}
                          <SelectItem
                            value="Cyberpunk"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            Cyberpunk (Neon, Dystopian)
                          </SelectItem>{" "}
                          <SelectItem
                            value="Epic Fantasy"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            Epic Fantasy (Sweeping)
                          </SelectItem>{" "}
                          <SelectItem
                            value="Documentary"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            Raw Documentary
                          </SelectItem>{" "}
                        </SelectContent>{" "}
                      </Select>{" "}
                    </div>{" "}
                    <div className="space-y-3 relative">
                      {" "}
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                        Aspect Ratio
                      </Label>{" "}
                      <Select
                        value={aspectRatio}
                        onValueChange={(v) => setAspectRatio(v as AspectRatio)}
                      >
                        {" "}
                        <SelectTrigger className="w-full h-11 bg-white border-slate-200 focus:ring-violet-500 rounded-xl transition-all hover:bg-slate-100">
                          {" "}
                          <SelectValue placeholder="Select aspect ratio" />{" "}
                        </SelectTrigger>{" "}
                        <SelectContent className="bg-white border-slate-200 text-slate-900 rounded-xl shadow-sm">
                          {" "}
                          <SelectItem
                            value="16:9"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            16:9 (Landscape)
                          </SelectItem>{" "}
                          <SelectItem
                            value="9:16"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            9:16 (Portrait)
                          </SelectItem>{" "}
                          <SelectItem
                            value="1:1"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            1:1 (Square)
                          </SelectItem>{" "}
                          <SelectItem
                            value="4:3"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            4:3 (Standard)
                          </SelectItem>{" "}
                          <SelectItem
                            value="3:4"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            3:4 (Vertical)
                          </SelectItem>{" "}
                          <SelectItem
                            value="custom"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            Custom...
                          </SelectItem>{" "}
                        </SelectContent>{" "}
                      </Select>{" "}
                      {aspectRatio === "custom" && (
                        <div className="absolute left-0 top-[100%] mt-2 w-full z-10">
                          {" "}
                          <input
                            type="text"
                            value={customAspectRatio}
                            onChange={(e) =>
                              setCustomAspectRatio(e.target.value)
                            }
                            placeholder="e.g. 21:9"
                            className="w-full h-10 px-3 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 focus:outline-none focus:ring-1 focus:ring-violet-500 shadow-md"
                          />{" "}
                        </div>
                      )}{" "}
                    </div>{" "}
                    <div className="space-y-3">
                      {" "}
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                        Resolution
                      </Label>{" "}
                      <Select
                        value={resolution}
                        onValueChange={(v) => setResolution(v as Resolution)}
                      >
                        {" "}
                        <SelectTrigger className="w-full h-11 bg-white border-slate-200 focus:ring-violet-500 rounded-xl transition-all hover:bg-slate-100">
                          {" "}
                          <SelectValue placeholder="Select resolution" />{" "}
                        </SelectTrigger>{" "}
                        <SelectContent className="bg-white border-slate-200 text-slate-900 rounded-xl shadow-sm">
                          {" "}
                          <SelectItem
                            value="original"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            Original (Fastest)
                          </SelectItem>{" "}
                          <SelectItem
                            value="720p"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            720p (HD)
                          </SelectItem>{" "}
                          <SelectItem
                            value="1080p"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            1080p (Full HD)
                          </SelectItem>{" "}
                          <SelectItem
                            value="4k"
                            className="focus:bg-slate-100 cursor-pointer rounded-lg"
                          >
                            4K (Ultra HD)
                          </SelectItem>{" "}
                        </SelectContent>{" "}
                      </Select>{" "}
                    </div>{" "}
                    <div className="space-y-3 w-full">
                      {" "}
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                        Scenes
                      </Label>{" "}
                      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-1 h-11 hover:border-gray-300 transition-all w-full">
                        {" "}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors text-slate-600"
                          onClick={() =>
                            setNumScenes(Math.max(1, numScenes - 1))
                          }
                          disabled={numScenes <= 1}
                        >
                          {" "}
                          <Minus className="w-3.5 h-3.5" />{" "}
                        </Button>{" "}
                        <div className="flex items-center justify-center">
                          {" "}
                          <span className="text-sm font-bold text-slate-900 tabular-nums">
                            {numScenes}
                          </span>{" "}
                        </div>{" "}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors text-slate-600"
                          onClick={() =>
                            setNumScenes(Math.min(10, numScenes + 1))
                          }
                          disabled={numScenes >= 10}
                        >
                          {" "}
                          <Plus className="w-3.5 h-3.5" />{" "}
                        </Button>{" "}
                      </div>{" "}
                    </div>{" "}
                    <div className="space-y-3 w-full">
                      {" "}
                      <Label className="text-sm font-medium text-slate-700 whitespace-nowrap">
                        Frames per Scene
                      </Label>{" "}
                      <div className="flex items-center justify-between bg-white border border-slate-200 rounded-xl p-1 h-11 hover:border-gray-300 transition-all w-full">
                        {" "}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors text-slate-600"
                          onClick={() =>
                            setFramesPerScene(Math.max(1, framesPerScene - 1))
                          }
                          disabled={framesPerScene <= 1}
                        >
                          {" "}
                          <Minus className="w-3.5 h-3.5" />{" "}
                        </Button>{" "}
                        <div className="flex items-center justify-center">
                          {" "}
                          <span className="text-sm font-bold text-slate-900 tabular-nums">
                            {framesPerScene}
                          </span>{" "}
                        </div>{" "}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-slate-100 hover:text-slate-900 transition-colors text-slate-600"
                          onClick={() =>
                            setFramesPerScene(Math.min(10, framesPerScene + 1))
                          }
                          disabled={framesPerScene >= 10}
                        >
                          {" "}
                          <Plus className="w-3.5 h-3.5" />{" "}
                        </Button>{" "}
                      </div>{" "}
                    </div>{" "}
                  </div>{" "}
                </CardContent>{" "}
                <div className="p-6 bg-white border-t border-slate-200">
                  {" "}
                  <Button
                    className="w-full text-base h-12 font-bold bg-violet-600 hover:bg-violet-700 hover:scale-100 text-white shadow-sm shadow-violet-600/20 rounded-xl transition-all hover:scale-[1.01] active:scale-[0.98]"
                    onClick={handleAnalyze}
                  >
                    {" "}
                    Generate Storyboard{" "}
                  </Button>{" "}
                </div>{" "}
              </Card>{" "}
            </motion.div>
          )}{" "}
          {appState === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-24 space-y-10 max-w-lg mx-auto"
            >
              {" "}
              <div className="relative group">
                {" "}
                <div className="absolute inset-0 bg-violet-600 blur-[3rem] opacity-30 rounded-lg animate-pulse group-hover:opacity-40 transition-opacity" />{" "}
                <div className="w-32 h-32 rounded-2xl border-4 border-slate-200 border-t-violet-500 animate-spin relative z-10 shadow-sm " />{" "}
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  {" "}
                  <div className="text-center">
                    {" "}
                    <span className="block text-3xl font-extrabold text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600 tabular-nums">
                      {Math.round(progress)}%
                    </span>{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
              <div className="space-y-6 w-full text-center px-4">
                {" "}
                <div className="space-y-2">
                  {" "}
                  <h2 className="text-slate-900 font-bold text-3xl tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600">
                    Analysis Unit
                  </h2>{" "}
                  <p className="text-violet-600 font-medium text-xs tracking-widest uppercase">
                    {loadingMessage}
                  </p>{" "}
                </div>{" "}
                <div className="w-full h-2.5 bg-white rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                  {" "}
                  <motion.div
                    className="h-full bg-gradient-to-r from-violet-600 to-fuchsia-600 rounded-lg"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "spring", bounce: 0, duration: 0.5 }}
                  />{" "}
                </div>{" "}
                <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block shadow-sm">
                  {" "}
                  <p className="text-slate-700 text-sm italic font-medium">
                    "Evaluating your story's potential and identifying key
                    characters..."
                  </p>{" "}
                </div>{" "}
              </div>{" "}
            </motion.div>
          )}{" "}
          {appState === "planning" && !storyboard && (
            <motion.div
              key="planning-initial"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center justify-center py-24 space-y-10 max-w-lg mx-auto"
            >
              {" "}
              <div className="relative group">
                {" "}
                <div className="absolute inset-0 bg-fuchsia-600 blur-[3rem] opacity-30 rounded-lg animate-pulse group-hover:opacity-40 transition-opacity" />{" "}
                <div className="w-32 h-32 rounded-2xl border-4 border-slate-200 border-t-fuchsia-500 animate-spin relative z-10 shadow-sm " />{" "}
                <div className="absolute inset-0 flex items-center justify-center z-20">
                  {" "}
                  <LayoutTemplate className="w-10 h-10 text-fuchsia-600 animate-pulse" />{" "}
                </div>{" "}
              </div>{" "}
              <div className="space-y-6 w-full text-center px-4">
                {" "}
                <div className="space-y-2">
                  {" "}
                  <h2 className="text-slate-900 font-bold text-3xl tracking-tight leading-none bg-clip-text text-transparent bg-gradient-to-r from-fuchsia-600 to-rose-600">
                    Pre-Production
                  </h2>{" "}
                  <p className="text-fuchsia-600 font-medium text-xs tracking-widest uppercase">
                    {loadingMessage}
                  </p>{" "}
                </div>{" "}
                <div className="w-full h-2.5 bg-white rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                  {" "}
                  <motion.div
                    className="h-full bg-gradient-to-r from-fuchsia-600 to-rose-600 rounded-lg"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ type: "tween", ease: "linear", duration: 0.4 }}
                  />{" "}
                </div>{" "}
                <div className="bg-white p-4 rounded-xl border border-slate-200 inline-block shadow-sm">
                  {" "}
                  <p className="text-slate-700 text-sm italic font-medium">
                    "Script Writers, Directors, and Cinematographers are
                    finalizing the production bible..."
                  </p>{" "}
                </div>{" "}
              </div>{" "}
            </motion.div>
          )}{" "}
          {appState === "needs_improvement" && (
            <motion.div
              key="needs_improvement"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              {" "}
              <Alert className="bg-amber-500/10 border-amber-500/30 text-amber-800 rounded-xl shadow-sm">
                {" "}
                <AlertCircle className="h-5 w-5 text-amber-500" />{" "}
                <AlertTitle className="font-bold text-amber-500 text-base">
                  Prompt Analysis Results
                </AlertTitle>{" "}
                <AlertDescription className="text-amber-800 mt-1.5 text-sm">
                  {" "}
                  We've analyzed your prompt based on key storytelling
                  parameters. Review the analysis and suggestions below.{" "}
                </AlertDescription>{" "}
              </Alert>{" "}
              {analysis && (
                <Card className="border-slate-200 bg-white shadow-sm overflow-hidden rounded-2xl">
                  {" "}
                  <div className="bg-white px-6 py-4 border-b border-slate-200">
                    {" "}
                    <h3 className="text-sm font-bold text-slate-700 uppercase tracking-widest bg-clip-text text-transparent bg-gradient-to-r from-slate-200 to-slate-500">
                      Story Parameters
                    </h3>{" "}
                  </div>{" "}
                  <CardContent className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
                    {" "}
                    <div className="space-y-1.5">
                      {" "}
                      <span className="text-[11px] font-bold text-violet-400 uppercase tracking-widest">
                        Suggested Title
                      </span>{" "}
                      <p className="text-sm font-medium text-slate-900">
                        {analysis.title}
                      </p>{" "}
                    </div>{" "}
                    <div className="space-y-1.5">
                      {" "}
                      <span className="text-[11px] font-bold text-violet-400 uppercase tracking-widest">
                        Characters / Scenes
                      </span>{" "}
                      <p className="text-sm font-medium text-slate-900">
                        {analysis.numCharacters} Characters |{" "}
                        {analysis.numScenes} Scenes
                      </p>{" "}
                    </div>{" "}
                    <div className="space-y-1.5 md:col-span-2">
                      {" "}
                      <span className="text-[11px] font-bold text-fuchsia-600 uppercase tracking-widest">
                        Objective
                      </span>{" "}
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {analysis.objective}
                      </p>{" "}
                    </div>{" "}
                    <div className="space-y-1.5 md:col-span-2">
                      {" "}
                      <span className="text-[11px] font-bold text-fuchsia-600 uppercase tracking-widest">
                        Core Message
                      </span>{" "}
                      <p className="text-sm text-slate-700 leading-relaxed">
                        {analysis.message}
                      </p>{" "}
                    </div>{" "}
                    <div className="space-y-1.5 md:col-span-2 pt-4 border-t border-slate-200">
                      {" "}
                      <span className="text-[11px] font-bold text-amber-600 uppercase tracking-widest">
                        Consistency Check
                      </span>{" "}
                      <p className="text-sm text-slate-600 italic leading-relaxed">
                        "{analysis.consistencyCheck}"
                      </p>{" "}
                    </div>{" "}
                  </CardContent>{" "}
                </Card>
              )}{" "}
              {guide && (
                <Card className="border-amber-500/20 shadow-sm overflow-hidden bg-amber-500/5 rounded-2xl">
                  {" "}
                  <div className="bg-amber-500/10 px-6 py-4 border-b border-amber-500/20">
                    {" "}
                    <h3 className="text-sm font-bold text-amber-500 uppercase tracking-widest">
                      How to write a better prompt
                    </h3>{" "}
                  </div>{" "}
                  <CardContent className="p-6 space-y-5">
                    {" "}
                    {guide.missingElements &&
                      guide.missingElements.length > 0 && (
                        <div>
                          {" "}
                          <span className="text-[11px] font-bold text-amber-500/80 uppercase tracking-widest">
                            Missing Elements
                          </span>{" "}
                          <div className="flex flex-wrap gap-2 mt-2">
                            {" "}
                            {guide.missingElements.map((el, i) => (
                              <span
                                key={i}
                                className="bg-amber-500/20 text-amber-800 border border-amber-500/30 text-[11px] px-3 py-1 rounded-lg font-bold shadow-sm"
                              >
                                {el}
                              </span>
                            ))}{" "}
                          </div>{" "}
                        </div>
                      )}{" "}
                    <div>
                      {" "}
                      <span className="text-[11px] font-bold text-amber-500/80 uppercase tracking-widest">
                        Ingredients of a Good Prompt
                      </span>{" "}
                      <p className="text-sm text-slate-900 mt-1.5 leading-relaxed">
                        {guide.ingredients}
                      </p>{" "}
                    </div>{" "}
                    <div className="bg-white p-4 rounded-xl border border-amber-500/20 shadow-inner">
                      {" "}
                      <span className="text-[11px] font-bold text-amber-500/80 uppercase tracking-widest">
                        Example
                      </span>{" "}
                      <p className="text-sm text-amber-100/90 mt-1.5 italic leading-relaxed">
                        "{guide.example}"
                      </p>{" "}
                    </div>{" "}
                  </CardContent>{" "}
                </Card>
              )}{" "}
              <div className="space-y-5">
                {" "}
                {identifiedCharacters.length > 0 && (
                  <div className="space-y-4 mb-8">
                    {" "}
                    <h3 className="text-xs font-bold text-slate-600 uppercase tracking-widest">
                      Identified Characters
                    </h3>{" "}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {" "}
                      {identifiedCharacters.map((char, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-4 bg-white p-4 rounded-xl border border-slate-200 shadow-sm group hover:border-violet-500/30 transition-colors"
                        >
                          {" "}
                          <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 flex items-center justify-center text-violet-600 font-bold border border-violet-500/30 group-hover:scale-105 transition-transform text-lg">
                            {" "}
                            {char.name[0]}{" "}
                          </div>{" "}
                          <div>
                            {" "}
                            <p className="text-sm font-bold text-slate-900">
                              {char.name}
                            </p>{" "}
                            <p className="text-xs text-slate-600 line-clamp-1 mt-0.5">
                              {char.visualDescription}
                            </p>{" "}
                          </div>{" "}
                        </div>
                      ))}{" "}
                    </div>{" "}
                  </div>
                )}{" "}
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-semibold text-zinc-500 uppercase tracking-widest">
                    Suggested Improvements
                  </h3>
                  {suggestions.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const content = suggestions.map((s, i) => `Suggestion ${i + 1}:\n\nExplanation: ${s.explanation}\nScenes: ${s.scenes}\nFrames Per Scene: ${s.framesPerScene}\nCharacters: ${s.characters.join(", ")}\n\nPrompt:\n${s.prompt}\n\n--------------------------------------------------\n\n`).join("");
                        const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
                        downloadBlob(blob, "suggested_prompts.txt");
                        toast.success("Suggested prompts downloaded!");
                      }}
                      className="rounded-lg bg-white border-slate-200 hover:bg-slate-100 text-slate-700 hover:text-slate-950 shadow-sm transition-all text-xs h-8"
                    >
                      <Download className="w-3.5 h-3.5 mr-2 text-violet-500" />
                      Download Suggestions
                    </Button>
                  )}
                </div>{" "}
                {suggestions.map((s, i) => (
                  <motion.div
                    key={i}
                    whileHover={{ scale: 1.01 }}
                    whileTap={{ scale: 0.99 }}
                  >
                    {" "}
                    <Card
                      className="border-slate-200 bg-white hover:border-violet-500/30 hover:bg-white shadow-sm transition-all cursor-pointer overflow-hidden group rounded-xl "
                      onClick={() => {
                        setPrompt(s.prompt);
                        setSkipAnalysisForCurrentPrompt(true);
                        setAppState("idle");
                        toast.success(
                          "Prompt updated! Click Generate to proceed directly to planning.",
                        );
                      }}
                    >
                      {" "}
                      <div className="h-[2px] w-0 bg-violet-600 hover:bg-violet-700 group-hover:w-full transition-all duration-500" />{" "}
                      <CardContent className="p-6 space-y-4">
                        <div className="flex justify-between items-start gap-4">
                          <p className="text-slate-900 font-medium leading-relaxed flex-1 text-justify">
                            {s.prompt}
                          </p>
                          <div className="flex flex-col items-end shrink-0 gap-1.5 pt-1">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border bg-slate-50 text-slate-400 border-slate-100 uppercase tracking-tighter">
                              {s.prompt.length} chars
                            </span>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100/50 px-2 py-0.5 rounded border border-slate-200/50 flex items-center gap-1">
                                <Layout className="w-2.5 h-2.5" /> {s.scenes} SCENES
                              </span>
                              <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest bg-slate-100/50 px-2 py-0.5 rounded border border-slate-200/50 flex items-center gap-1">
                                <MonitorStop className="w-2.5 h-2.5" /> {s.framesPerScene} FRAMES/SCENE
                              </span>
                            </div>
                          </div>
                        </div>

                        {s.characters && s.characters.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 pt-1.5 border-t border-slate-100/50">
                            <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mr-1 self-center">
                              STORY CHARACTERS:
                            </span>
                            {s.characters.map((name, charIdx) => (
                              <span
                                key={charIdx}
                                className="text-[10px] font-bold text-violet-600 bg-violet-50 px-2 py-0.5 rounded-lg border border-violet-100 flex items-center gap-1"
                              >
                                <User className="w-2.5 h-2.5" /> {name}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="flex items-start gap-3 bg-emerald-50 text-emerald-700 p-3 rounded-xl border border-emerald-200 text-sm shadow-inner overflow-hidden relative">
                          {" "}
                          <div className="absolute inset-0 bg-emerald-500/5 mix-blend-overlay"></div>{" "}
                          <Check className="w-4 h-4 mt-0.5 shrink-0 relative z-10" />{" "}
                          <span className="relative z-10">
                            {s.explanation}
                          </span>{" "}
                        </div>{" "}
                        <div className="pt-2 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          {" "}
                          <span className="text-[11px] font-bold text-violet-600 flex items-center gap-1 uppercase tracking-widest bg-violet-500/10 px-3 py-1 rounded-lg border border-violet-500/20">
                            {" "}
                            USE THIS PROMPT{" "}
                            <ArrowRight className="w-3 h-3" />{" "}
                          </span>{" "}
                        </div>{" "}
                      </CardContent>{" "}
                    </Card>{" "}
                  </motion.div>
                ))}{" "}
              </div>{" "}
              <div className="flex items-center gap-4 pt-6 border-t border-slate-200">
                {" "}
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-xl font-bold bg-white0 border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-950 transition-all active:scale-[0.98]"
                  onClick={() => setAppState("idle")}
                >
                  {" "}
                  Edit Original Prompt{" "}
                </Button>{" "}
                <Button
                  variant="secondary"
                  className="flex-1 h-12 rounded-xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-600 text-slate-900 hover:from-violet-500 hover:to-fuchsia-500 shadow-sm shadow-violet-900/20 transition-all active:scale-[0.98]"
                  onClick={() => handlePlan(prompt, identifiedCharacters)}
                >
                  {" "}
                  Proceed Anyway{" "}
                </Button>{" "}
              </div>{" "}
            </motion.div>
          )}{" "}
          {(appState === "planning" || appState === "ready") && storyboard && (
            <motion.div
              key="storyboard"
              initial={{ opacity: 0, y: 40, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="space-y-10"
            >
              {" "}
              <div className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm relative overflow-hidden">
                {" "}
                <div className="absolute top-0 right-0 w-64 h-64 bg-violet-600 rounded-lg blur-[4rem] -z-10 transform translate-x-1/2 -translate-y-1/2 opacity-20" />{" "}
                <h2 className="text-3xl font-extrabold tracking-tight mb-3 text-slate-900 bg-gradient-to-br from-slate-800 to-slate-500">
                  {storyboard.title}
                </h2>{" "}
                <p className="text-slate-700 mb-8 leading-relaxed max-w-3xl">
                  {storyboard.storySummary}
                </p>{" "}
                {storyboard.storyTreatment && (
                  <div className="mb-8 bg-white p-6 rounded-xl border border-slate-200 relative overflow-hidden shadow-inner">
                    {" "}
                    <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-fuchsia-500 to-violet-500" />{" "}
                    <span className="text-xs font-bold text-violet-400 uppercase tracking-widest block mb-2">
                      Director's Treatment
                    </span>{" "}
                    <p className="text-slate-900 leading-relaxed italic text-lg">
                      "{storyboard.storyTreatment}"
                    </p>{" "}
                  </div>
                )}{" "}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  {" "}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-inner">
                    {" "}
                    <span className="text-[11px] font-bold text-fuchsia-600 uppercase tracking-widest block mb-2 transition-colors">
                      Art Style
                    </span>{" "}
                    <p className="text-slate-900 leading-relaxed font-medium">
                      {storyboard.artStyle}
                    </p>{" "}
                  </div>{" "}
                  <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-inner">
                    {" "}
                    <span className="text-[11px] font-bold text-fuchsia-600 uppercase tracking-widest block mb-2">
                      Characters
                    </span>{" "}
                    <div className="space-y-2">
                      {" "}
                      {storyboard.characters.map((char, idx) => (
                        <div
                          key={idx}
                          className="text-slate-700 leading-relaxed"
                        >
                          {" "}
                          <span className="font-bold text-slate-900 px-2 py-0.5 rounded-md mr-2">
                            {char.name}
                          </span>{" "}
                          {char.visualDescription}{" "}
                        </div>
                      ))}{" "}
                    </div>{" "}
                  </div>{" "}
                </div>{" "}
              </div>{" "}
              {appState === "planning" && (
                <div className="flex flex-col items-center justify-center py-16 space-y-6 max-w-md mx-auto">
                  {" "}
                  <div className="relative group">
                    {" "}
                    <div className="absolute inset-0 bg-violet-500 blur-2xl opacity-20 rounded-lg animate-pulse group-hover:opacity-40 transition-opacity" />{" "}
                    <Loader2 className="w-16 h-16 text-violet-400 animate-spin relative z-10 drop-shadow-md" />{" "}
                  </div>{" "}
                  <div className="space-y-4 w-full text-center">
                    {" "}
                    <p className="text-slate-900 font-extrabold text-xl bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600">
                      {loadingMessage}
                    </p>{" "}
                    <div className="w-full h-2 bg-white rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                      {" "}
                      <motion.div
                        className="h-full bg-violet-600 hover:bg-violet-700 rounded-lg"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ type: "tween", ease: "linear", duration: 0.4 }}
                      />{" "}
                    </div>{" "}
                    <p className="text-violet-600/60 text-xs italic uppercase tracking-widest font-bold">
                      Finalizing scene breakdowns...
                    </p>{" "}
                  </div>{" "}
                </div>
              )}{" "}
              {appState === "ready" && (
                <div className="space-y-16">
                  {" "}
                  {storyboard.scenes.map((scene, sceneIndex) => (
                    <div key={sceneIndex} className="space-y-8">
                      {" "}
                      <div className="flex items-center gap-5">
                        {" "}
                        <h3 className="text-3xl font-black text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700 drop-shadow-sm">
                          Scene {scene.sceneNumber}
                        </h3>{" "}
                        <div className="h-0.5 bg-gradient-to-r from-white/10 to-transparent flex-1 rounded-lg" />{" "}
                        <span className="text-sm font-bold text-violet-200 bg-violet-900/30 px-4 py-1.5 rounded-lg border border-violet-500/20 shadow-inner tracking-wide uppercase">
                          {scene.setting}
                        </span>{" "}
                        {scene.frames.some(
                          (f) => f.status === "pending" || f.status === "error",
                        ) && (
                          <motion.button
                            whileTap={{ scale: 0.95 }}
                            whileHover={{ scale: 1.02 }}
                            className="bg-violet-600 hover:bg-violet-700 hover:scale-100 text-slate-900 font-bold rounded-xl px-4 py-2 relative overflow-hidden shadow-sm shadow-violet-900/30 text-sm flex items-center gap-2"
                            onClick={() => handleGenerateScene(sceneIndex)}
                            disabled={scene.frames.some(
                              (f) => f.status === "generating",
                            )}
                          >
                            {" "}
                            {scene.frames.some(
                              (f) => f.status === "generating",
                            ) ? (
                              <>
                                {" "}
                                <Loader2 className="w-4 h-4 mr-2 animate-spin text-slate-900" />{" "}
                                <span className="z-10">
                                  {sceneProgress[sceneIndex] !== undefined
                                    ? `${Math.round(sceneProgress[sceneIndex])}%`
                                    : "Generating..."}
                                </span>{" "}
                                {sceneProgress[sceneIndex] !== undefined && (
                                  <motion.div
                                    className="absolute bottom-0 left-0 h-[2px] bg-white"
                                    initial={{ width: 0 }}
                                    animate={{
                                      width: `${sceneProgress[sceneIndex]}%`,
                                    }}
                                    transition={{
                                      type: "tween",
                                      ease: "linear",
                                      duration: 0.2,
                                    }}
                                  />
                                )}{" "}
                              </>
                            ) : (
                              <>
                                <ImageIcon className="w-4 h-4 ml-[-4px]" />{" "}
                                Generate Scene
                              </>
                            )}{" "}
                          </motion.button>
                        )}{" "}
                      </div>{" "}
                      {scene.description && (
                        <p className="text-slate-700 text-lg leading-relaxed max-w-4xl pl-2">
                          {scene.description}
                        </p>
                      )}{" "}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {" "}
                        {scene.frames.map((frame, frameIndex) => (
                          <motion.div
                            key={frameIndex}
                            initial={{ opacity: 0, y: 40, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{
                              delay: frameIndex * 0.1,
                              duration: 0.5,
                              type: "spring",
                              bounce: 0,
                            }}
                          >
                            {" "}
                            <Card className="overflow-hidden border-slate-200 shadow-md hover:shadow-[0_8px_30px_rgba(139,92,246,0.12)] hover:border-violet-500/30 transition-all duration-500 flex flex-col h-full bg-white rounded-xl group">
                              {" "}
                              <div
                                className={`relative ${getAspectRatioClass(storyboard.aspectRatio)} bg-white flex items-center justify-center overflow-hidden border-b border-slate-200`}
                              >
                                {" "}
                                {frame.status === "pending" && (
                                  <div className="flex flex-col items-center gap-4 text-violet-400 p-6 text-center bg-white w-full h-full justify-center group-hover:bg-white transition-colors">
                                    {" "}
                                    <div className="w-16 h-16 rounded-lg bg-violet-500/10 flex items-center justify-center border border-violet-500/20 shadow-inner group-hover:scale-110 transition-transform">
                                      {" "}
                                      <ImageIcon className="w-8 h-8 opacity-80" />{" "}
                                    </div>{" "}
                                    <span className="text-sm font-bold tracking-widest uppercase">
                                      Ready to Generate
                                    </span>{" "}
                                  </div>
                                )}{" "}
                                {frame.status === "generating" && (
                                  <div className="flex flex-col items-center gap-5 w-full h-full justify-center bg-white">
                                    {" "}
                                    <div className="relative">
                                      {" "}
                                      <div className="absolute inset-0 bg-fuchsia-500 blur-xl opacity-30 rounded-lg animate-pulse" />{" "}
                                      <Loader2 className="w-12 h-12 animate-spin text-fuchsia-600 relative z-10" />{" "}
                                    </div>{" "}
                                    <span className="text-[10px] font-bold text-fuchsia-600 uppercase tracking-widest bg-fuchsia-500/10 px-4 py-1.5 rounded-lg border border-fuchsia-500/20 shadow-inner">
                                      Generating Frame {frame.frameNumber}
                                    </span>{" "}
                                  </div>
                                )}{" "}
                                {frame.status === "error" && (
                                  <div className="flex flex-col items-center gap-4 text-rose-500 p-6 text-center bg-rose-950/20 w-full h-full justify-center">
                                    {" "}
                                    <AlertCircle className="w-12 h-12 opacity-80 animate-pulse text-rose-400" />{" "}
                                    <span className="text-sm font-black uppercase tracking-widest text-rose-600">
                                      Generation Failed
                                    </span>{" "}
                                    <span
                                      className="text-xs text-rose-200/60 max-w-[90%] line-clamp-3 bg-rose-900/20 p-2 rounded-lg border border-rose-500/20"
                                      title={frame.errorMessage}
                                    >
                                      {frame.errorMessage}
                                    </span>{" "}
                                  </div>
                                )}{" "}
                                {frame.status === "completed" &&
                                  frame.imageUrl && (
                                    <motion.div
                                      initial={{ opacity: 0, scale: 1.05 }}
                                      animate={{ opacity: 1, scale: 1 }}
                                      transition={{
                                        duration: 0.8,
                                        ease: "easeOut",
                                      }}
                                      className="w-full h-full relative"
                                    >
                                      {" "}
                                      <img
                                        src={frame.imageUrl}
                                        alt={`Frame ${frame.frameNumber}`}
                                        className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
                                        referrerPolicy="no-referrer"
                                      />{" "}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />{" "}
                                      <div className="absolute bottom-4 right-4 bg-black/60 text-slate-900 text-xs font-black font-mono px-3 py-1.5 rounded-lg select-none pointer-events-none border border-gray-300 shadow-md">
                                        {" "}
                                        {String(frame.frameNumber).padStart(
                                          2,
                                          "0",
                                        )}{" "}
                                      </div>{" "}
                                    </motion.div>
                                  )}{" "}
                              </div>{" "}
                              <CardContent className="p-6 flex-1 flex flex-col justify-between gap-6">
                                {" "}
                                <div className="space-y-5">
                                  {" "}
                                  <p className="text-sm font-medium text-slate-900 leading-relaxed italic p-4 rounded-xl border border-slate-200">
                                    "{frame.caption}"
                                  </p>{" "}
                                  {(frame.cameraIntent ||
                                    frame.characterExpression ||
                                    frame.lightingIntent ||
                                    frame.costumeDesign ||
                                    frame.cinematographyNotes) && (
                                    <div className="grid grid-cols-1 gap-4 pt-4 border-t border-slate-200">
                                      {" "}
                                      {frame.cameraIntent && (
                                        <div className="flex items-start gap-3 bg-white0 p-3 rounded-xl border border-slate-200 hover:border-violet-500/20 transition-colors">
                                          {" "}
                                          <div className="p-2 bg-violet-500/10 rounded-lg text-violet-400">
                                            {" "}
                                            <Settings2 className="w-4 h-4" />{" "}
                                          </div>{" "}
                                          <div className="space-y-1">
                                            {" "}
                                            <p className="text-[10px] font-bold text-violet-400 uppercase tracking-widest">
                                              Camera
                                            </p>{" "}
                                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                              {frame.cameraIntent}
                                            </p>{" "}
                                          </div>{" "}
                                        </div>
                                      )}{" "}
                                      {frame.lightingIntent && (
                                        <div className="flex items-start gap-3 bg-white0 p-3 rounded-xl border border-slate-200 hover:border-amber-500/20 transition-colors">
                                          {" "}
                                          <div className="p-2 bg-amber-500/10 rounded-lg text-amber-600">
                                            {" "}
                                            <RefreshCw className="w-4 h-4" />{" "}
                                          </div>{" "}
                                          <div className="space-y-1">
                                            {" "}
                                            <p className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">
                                              Lighting
                                            </p>{" "}
                                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                              {frame.lightingIntent}
                                            </p>{" "}
                                          </div>{" "}
                                        </div>
                                      )}{" "}
                                      {frame.characterExpression && (
                                        <div className="flex items-start gap-3 bg-white0 p-3 rounded-xl border border-slate-200 hover:border-indigo-500/20 transition-colors">
                                          {" "}
                                          <div className="p-2 bg-indigo-500/10 rounded-lg text-indigo-600">
                                            {" "}
                                            <RefreshCw className="w-4 h-4" />{" "}
                                          </div>{" "}
                                          <div className="space-y-1">
                                            {" "}
                                            <p className="text-[10px] font-bold text-indigo-600 uppercase tracking-widest">
                                              Expression
                                            </p>{" "}
                                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                              {frame.characterExpression}
                                            </p>{" "}
                                          </div>{" "}
                                        </div>
                                      )}{" "}
                                      {frame.makeupAndHairDetail && (
                                        <div className="flex items-start gap-3 bg-white0 p-3 rounded-xl border border-slate-200 hover:border-fuchsia-500/20 transition-colors">
                                          {" "}
                                          <div className="p-2 bg-fuchsia-500/10 rounded-lg text-fuchsia-600">
                                            {" "}
                                            <Sparkles className="w-4 h-4" />{" "}
                                          </div>{" "}
                                          <div className="space-y-1">
                                            {" "}
                                            <p className="text-[10px] font-bold text-fuchsia-600 uppercase tracking-widest">
                                              Makeup & Hair
                                            </p>{" "}
                                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                              {frame.makeupAndHairDetail}
                                            </p>{" "}
                                          </div>{" "}
                                        </div>
                                      )}{" "}
                                      {frame.costumeDesign && (
                                        <div className="flex items-start gap-3 bg-white0 p-3 rounded-xl border border-slate-200 hover:border-rose-500/20 transition-colors">
                                          {" "}
                                          <div className="p-2 bg-rose-500/10 rounded-lg text-rose-600">
                                            {" "}
                                            <Shirt className="w-4 h-4" />{" "}
                                          </div>{" "}
                                          <div className="space-y-1">
                                            {" "}
                                            <p className="text-[10px] font-bold text-rose-600 uppercase tracking-widest">
                                              Costume
                                            </p>{" "}
                                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                              {frame.costumeDesign}
                                            </p>{" "}
                                          </div>{" "}
                                        </div>
                                      )}{" "}
                                      {frame.cinematographyNotes && (
                                        <div className="flex items-start gap-3 bg-white0 p-3 rounded-xl border border-slate-200 hover:border-emerald-200 transition-colors">
                                          {" "}
                                          <div className="p-2 bg-emerald-50 rounded-lg text-emerald-700">
                                            {" "}
                                            <LayoutTemplate className="w-4 h-4" />{" "}
                                          </div>{" "}
                                          <div className="space-y-1">
                                            {" "}
                                            <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-widest">
                                              Cinematography
                                            </p>{" "}
                                            <p className="text-xs text-slate-700 leading-relaxed font-medium">
                                              {frame.cinematographyNotes}
                                            </p>{" "}
                                          </div>{" "}
                                        </div>
                                      )}{" "}
                                      {frame.narrativeBeat && (
                                        <div className="flex items-start gap-3 bg-white0 p-3 rounded-xl border border-slate-200 hover:border-blue-500/20 transition-colors">
                                          {" "}
                                          <div className="p-2 bg-blue-500/10 rounded-lg text-blue-600">
                                            {" "}
                                            <MessageSquare className="w-4 h-4" />{" "}
                                          </div>{" "}
                                          <div className="space-y-1">
                                            {" "}
                                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-widest">
                                              Narrator's Voice
                                            </p>{" "}
                                            <p className="text-xs text-slate-700 leading-relaxed font-medium italic">
                                              "{frame.narrativeBeat}"
                                            </p>{" "}
                                          </div>{" "}
                                        </div>
                                      )}{" "}
                                      {frame.sceneDirectorNotes && (
                                        <div className="flex items-start gap-3 bg-violet-50/50 p-4 rounded-xl border border-violet-100 group-hover:border-violet-300 transition-all shadow-inner">
                                          {" "}
                                          <div className="p-2.5 bg-violet-600 rounded-lg text-white shadow-sm">
                                            {" "}
                                            <Video className="w-4 h-4" />{" "}
                                          </div>{" "}
                                          <div className="space-y-1.5">
                                            {" "}
                                            <p className="text-[10px] font-black text-violet-600 uppercase tracking-[0.2em]">
                                              Scene Director Notes
                                            </p>{" "}
                                            <p className="text-xs text-slate-800 leading-relaxed font-bold">
                                              {frame.sceneDirectorNotes}
                                            </p>{" "}
                                          </div>{" "}
                                        </div>
                                      )}
                                    </div>
                                  )}{" "}
                                </div>{" "}
                                <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
                                  {" "}
                                  {frame.status === "completed" && (
                                    <DropdownMenu>
                                      {" "}
                                      <DropdownMenuTrigger
                                        render={
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            className="h-9 text-xs font-bold text-slate-700 hover:text-slate-950 hover:bg-slate-100 transition-all rounded-lg px-3"
                                            disabled={isDownloading}
                                          >
                                            {" "}
                                            <Download className="w-4 h-4 mr-2" />{" "}
                                            Download{" "}
                                          </Button>
                                        }
                                      />{" "}
                                      <DropdownMenuContent
                                        align="end"
                                        className="bg-white border-slate-200 text-slate-900 rounded-xl shadow-sm p-2 min-w-[150px]"
                                      >
                                        {" "}
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleDownloadFrame(frame, "png")
                                          }
                                          className="hover:bg-slate-100 rounded-lg cursor-pointer py-2 font-medium"
                                        >
                                          {" "}
                                          Download as PNG{" "}
                                        </DropdownMenuItem>{" "}
                                        <DropdownMenuItem
                                          onClick={() =>
                                            handleDownloadFrame(frame, "jpeg")
                                          }
                                          className="hover:bg-slate-100 rounded-lg cursor-pointer py-2 font-medium"
                                        >
                                          {" "}
                                          Download as JPG{" "}
                                        </DropdownMenuItem>{" "}
                                      </DropdownMenuContent>{" "}
                                    </DropdownMenu>
                                  )}{" "}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-9 text-xs font-bold text-violet-600 hover:text-slate-950 hover:bg-violet-500/20 transition-all rounded-lg px-3"
                                    disabled={frame.status === "generating"}
                                    onClick={() => {
                                      setRegeneratingFrame({
                                        sceneIndex,
                                        frameIndex,
                                      });
                                      setSelectedCamera(
                                        frame.camera || "Default",
                                      );
                                      setSelectedLighting(
                                        frame.lighting || "Default",
                                      );
                                    }}
                                  >
                                    {" "}
                                    <RefreshCw
                                      className={`w-4 h-4 mr-2 ${frame.status === "generating" ? "animate-spin" : ""}`}
                                    />{" "}
                                    Regenerate{" "}
                                  </Button>{" "}
                                </div>{" "}
                              </CardContent>{" "}
                            </Card>{" "}
                          </motion.div>
                        ))}{" "}
                      </div>{" "}
                    </div>
                  ))}{" "}
                </div>
              )}{" "}
            </motion.div>
          )}{" "}
        </AnimatePresence>{" "}
      </main>{" "}
      <AnimatePresence>
        {" "}
        {isDownloading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-white/80 flex items-center justify-center p-6"
          >
            {" "}
            <Card className="w-full max-w-sm border-slate-200 shadow-sm overflow-hidden bg-white rounded-2xl">
              {" "}
              <div className="bg-gradient-to-r from-violet-600 to-fuchsia-600 px-6 py-5 flex items-center gap-4">
                {" "}
                <DownloadCloud className="w-6 h-6 text-slate-900 animate-bounce drop-shadow" />{" "}
                <h3 className="text-slate-900 font-extrabold text-lg tracking-tight">
                  Preparing Download
                </h3>{" "}
              </div>{" "}
              <CardContent className="p-8 space-y-5">
                {" "}
                <div className="flex justify-between items-end mb-2">
                  {" "}
                  <span className="text-sm font-bold text-slate-700">
                    Processing images...
                  </span>{" "}
                  <span className="text-lg font-black text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600">
                    {Math.round(downloadProgress)}%
                  </span>{" "}
                </div>{" "}
                <div className="w-full h-3 bg-white rounded-lg overflow-hidden border border-slate-200 shadow-inner">
                  {" "}
                  <motion.div
                    className="h-full bg-violet-600 hover:bg-violet-700"
                    initial={{ width: 0 }}
                    animate={{ width: `${downloadProgress}%` }}
                    transition={{ type: "spring", bounce: 0 }}
                  />{" "}
                </div>{" "}
                <p className="text-xs text-slate-600 text-center italic font-medium">
                  Optimizing for {resolution} resolution...
                </p>{" "}
              </CardContent>{" "}
            </Card>{" "}
          </motion.div>
        )}{" "}
      </AnimatePresence>{" "}
      <Dialog
        open={!!regeneratingFrame}
        onOpenChange={(open) => !open && setRegeneratingFrame(null)}
      >
        {" "}
        <DialogContent className="sm:max-w-[500px] bg-white border-slate-200 text-slate-900 rounded-2xl shadow-sm p-8">
          {" "}
          <DialogHeader>
            {" "}
            <DialogTitle className="text-2xl font-black text-slate-900 bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700">
              Regenerate Frame
            </DialogTitle>{" "}
          </DialogHeader>{" "}
          <div className="grid gap-8 py-6">
            {" "}
            <div className="space-y-5">
              {" "}
              <h4 className="text-xs font-bold leading-none text-violet-400 uppercase tracking-widest">
                Camera Angle
              </h4>{" "}
              <RadioGroup
                value={selectedCamera}
                onValueChange={setSelectedCamera}
                className="grid grid-cols-2 gap-3"
              >
                {" "}
                {[
                  "Default",
                  "Zoom in",
                  "Zoom out",
                  "Cinematic",
                  "Panoramic",
                  "Over the shoulder",
                  "Birds eye",
                ].map((option) => (
                  <div
                    key={option}
                    className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-slate-200 hover:border-violet-500/30 transition-colors"
                  >
                    {" "}
                    <RadioGroupItem
                      value={option}
                      id={`camera-${option}`}
                      className="border-slate-300 text-violet-500"
                    />{" "}
                    <Label
                      htmlFor={`camera-${option}`}
                      className="text-sm font-medium cursor-pointer text-slate-700 hover:text-slate-950 transition-colors flex-1"
                    >
                      {option}
                    </Label>{" "}
                  </div>
                ))}{" "}
              </RadioGroup>{" "}
            </div>{" "}
            <div className="space-y-5">
              {" "}
              <h4 className="text-xs font-bold leading-none text-amber-600 uppercase tracking-widest">
                Lighting Condition
              </h4>{" "}
              <RadioGroup
                value={selectedLighting}
                onValueChange={setSelectedLighting}
                className="grid grid-cols-2 gap-3"
              >
                {" "}
                {[
                  "Default",
                  "Golden hour",
                  "Blue hour",
                  "High noon",
                  "Silvery night",
                  "Soft diffused light",
                  "Dramatic chiaroscuro",
                  "Cinematic neon",
                ].map((option) => (
                  <div
                    key={option}
                    className="flex items-center space-x-3 bg-white p-2.5 rounded-xl border border-slate-200 hover:border-amber-500/30 transition-colors"
                  >
                    {" "}
                    <RadioGroupItem
                      value={option}
                      id={`lighting-${option}`}
                      className="border-slate-300 text-amber-500"
                    />{" "}
                    <Label
                      htmlFor={`lighting-${option}`}
                      className="text-sm font-medium cursor-pointer text-slate-700 hover:text-slate-950 transition-colors flex-1"
                    >
                      {option}
                    </Label>{" "}
                  </div>
                ))}{" "}
              </RadioGroup>{" "}
            </div>{" "}
          </div>{" "}
          <DialogFooter className="gap-3 sm:gap-0">
            {" "}
            <Button
              variant="outline"
              onClick={() => setRegeneratingFrame(null)}
              className="h-12 rounded-xl border-slate-200 text-slate-700 hover:text-slate-950 hover:bg-slate-100 font-bold px-6"
            >
              Cancel
            </Button>{" "}
            <Button
              onClick={() => {
                if (regeneratingFrame) {
                  handleRegenerateFrame(
                    regeneratingFrame.sceneIndex,
                    regeneratingFrame.frameIndex,
                    selectedCamera,
                    selectedLighting,
                  );
                  setRegeneratingFrame(null);
                }
              }}
              className="h-12 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-slate-900 hover:from-violet-500 hover:to-fuchsia-500 shadow-sm shadow-violet-900/20 font-bold px-6 transition-all active:scale-[0.98]"
            >
              Regenerate
            </Button>{" "}
          </DialogFooter>{" "}
        </DialogContent>{" "}
      </Dialog>{" "}
      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open);
          if (!open) setPreviewPlaying(false);
        }}
      >
        {" "}
        <DialogContent className="max-w-[95vw] w-full lg:max-w-7xl h-[90vh] bg-slate-950 border-slate-800 text-white rounded-2xl shadow-2xl p-0 overflow-hidden outline-none">
          {allCompletedFrames.length > 0 && (
            <div className="flex flex-col lg:flex-row h-full overflow-hidden">
              {/* Left Side: Cinematic Presentation Area */}
              <div className="flex-1 flex flex-col relative bg-black min-h-0">
                <div className="relative flex-1 flex items-center justify-center overflow-hidden w-full h-full p-4 md:p-8">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentPreviewFrameIndex}
                      initial={{ opacity: 0, scale: 1.1 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      transition={{ duration: 1, ease: "easeInOut" }}
                      className="relative w-full h-full flex items-center justify-center"
                    >
                      <div 
                        className="relative shadow-2xl shadow-black/50 overflow-hidden bg-slate-900 border border-white/5"
                        style={{ 
                          maxHeight: '100%', 
                          maxWidth: '100%', 
                          aspectRatio: (storyboard?.aspectRatio === "custom" ? customAspectRatio : storyboard?.aspectRatio || "16:9").replace(':', '/') 
                        }}
                      >
                        <img
                          src={allCompletedFrames[currentPreviewFrameIndex].imageUrl}
                          alt="Preview"
                          className="w-full h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                    </motion.div>
                  </AnimatePresence>
                  
                  {/* Overlay Info (Top) */}
                  <div className="absolute top-0 left-0 right-0 p-6 bg-gradient-to-b from-black/90 via-black/40 to-transparent pointer-events-none z-20">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="text-xl md:text-2xl font-black tracking-tighter text-white drop-shadow-xl flex items-center gap-2">
                          <span className="bg-fuchsia-600 px-2 py-0.5 rounded text-[10px] tracking-widest uppercase">Live</span>
                          {storyboard?.title}
                        </h3>
                        <p className="text-[10px] md:text-xs text-slate-300 font-bold uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
                          <MapPin className="w-3 h-3 text-fuchsia-400" />
                          Scene: {allCompletedFrames[currentPreviewFrameIndex].sceneSetting}
                        </p>
                      </div>
                      <div className="text-right hidden sm:block">
                        <p className="text-[10px] font-black text-white/40 uppercase tracking-widest">Frame</p>
                        <p className="text-xl font-black tabular-nums text-fuchsia-500">
                          {currentPreviewFrameIndex + 1} <span className="text-white/20">/</span> {allCompletedFrames.length}
                        </p>
                      </div>
                    </div>
                  </div>
                  
                  {/* Playback Controls Overlay (Center/Hover) */}
                  <div className="absolute inset-x-0 bottom-0 top-0 flex items-center justify-center gap-6 md:gap-12 opacity-0 hover:opacity-100 transition-opacity bg-black/20 z-30 group">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20 bg-black/40 backdrop-blur-md rounded-full h-12 w-12 md:h-16 md:w-16 transition-all hover:scale-110"
                      onClick={() => setCurrentPreviewFrameIndex((prev) => (prev - 1 + allCompletedFrames.length) % allCompletedFrames.length)}
                    >
                      <ArrowRight className="w-6 h-6 md:w-8 md:h-8 rotate-180" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20 bg-black/40 backdrop-blur-md rounded-full h-16 w-16 md:h-20 md:w-20 transition-all hover:scale-110"
                      onClick={() => setPreviewPlaying(!previewPlaying)}
                    >
                      {previewPlaying ? <Pause className="w-8 h-8 md:w-10 md:h-10 fill-current" /> : <Play className="w-8 h-8 md:w-10 md:h-10 fill-current ml-1" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="text-white hover:bg-white/20 bg-black/40 backdrop-blur-md rounded-full h-12 w-12 md:h-16 md:w-16 transition-all hover:scale-110"
                      onClick={() => setCurrentPreviewFrameIndex((prev) => (prev + 1) % allCompletedFrames.length)}
                    >
                      <ArrowRight className="w-6 h-6 md:w-8 md:h-8" />
                    </Button>
                  </div>
                </div>

                {/* Subtitles Area */}
                <div className="bg-black/60 backdrop-blur-sm border-y border-white/5 p-4 md:p-6 flex items-center justify-center min-h-[80px] md:min-h-[100px] shrink-0 overflow-hidden relative z-40">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={`caption-${currentPreviewFrameIndex}`}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="max-w-3xl mx-auto text-center px-4"
                    >
                      <p className="text-base md:text-xl text-white font-medium italic leading-relaxed drop-shadow-md">
                        "{allCompletedFrames[currentPreviewFrameIndex].caption}"
                      </p>
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* Timeline / Progress Navigation */}
                <div className="h-20 md:h-24 bg-slate-900 border-t border-white/5 flex items-center px-4 md:px-6 gap-3 overflow-x-auto no-scrollbar shrink-0 z-50">
                  {allCompletedFrames.map((f, idx) => (
                    <div
                      key={idx}
                      onClick={() => {
                        setCurrentPreviewFrameIndex(idx);
                        setPreviewPlaying(false);
                      }}
                      className={`h-12 md:h-14 aspect-video shrink-0 rounded-md overflow-hidden border-2 cursor-pointer transition-all ${
                        idx === currentPreviewFrameIndex 
                          ? "border-fuchsia-500 scale-105 shadow-lg shadow-fuchsia-500/20" 
                          : "border-transparent opacity-40 hover:opacity-100 hover:scale-105"
                      }`}
                    >
                      <img src={f.imageUrl} className="w-full h-full object-cover" />
                    </div>
                  ))}
                </div>
              </div>

              {/* Right Side: Director's Technical Dashboard */}
              <div className="hidden lg:flex w-[380px] bg-slate-900/50 backdrop-blur-xl border-l border-white/5 flex-col h-full overflow-hidden shrink-0">
                <div className="p-6 border-b border-white/10 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-fuchsia-500" />
                    <h4 className="text-sm font-black uppercase tracking-widest text-slate-200">Director's Suite</h4>
                  </div>
                  <div className="px-2 py-1 bg-white/5 rounded text-[9px] font-bold text-slate-400 uppercase tracking-tighter">
                    Technical Specs
                  </div>
                </div>
                
                <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6">
                  {/* Technical Notes Content */}
                  <div className="space-y-4">
                    {allCompletedFrames[currentPreviewFrameIndex].cameraIntent && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-fuchsia-500 uppercase tracking-widest flex items-center gap-2">
                          <Video className="w-3 h-3" /> Camera Intent
                        </p>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/5">
                          {allCompletedFrames[currentPreviewFrameIndex].cameraIntent}
                        </p>
                      </div>
                    )}
                    {allCompletedFrames[currentPreviewFrameIndex].lightingIntent && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-2">
                          <Sun className="w-3 h-3" /> Lighting Intent
                        </p>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/5">
                          {allCompletedFrames[currentPreviewFrameIndex].lightingIntent}
                        </p>
                      </div>
                    )}
                    {allCompletedFrames[currentPreviewFrameIndex].characterExpression && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-violet-400 uppercase tracking-widest flex items-center gap-2">
                          <User className="w-3 h-3" /> Character Expression
                        </p>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/5">
                          {allCompletedFrames[currentPreviewFrameIndex].characterExpression}
                        </p>
                      </div>
                    )}
                    {allCompletedFrames[currentPreviewFrameIndex].costumeDesign && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-2">
                          <Shirt className="w-3 h-3" /> Costume Design
                        </p>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/5">
                          {allCompletedFrames[currentPreviewFrameIndex].costumeDesign}
                        </p>
                      </div>
                    )}
                    {allCompletedFrames[currentPreviewFrameIndex].cinematographyNotes && (
                      <div className="space-y-1.5">
                        <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                          <Layout className="w-3 h-3" /> Cinematography
                        </p>
                        <p className="text-sm text-slate-300 leading-relaxed font-medium bg-white/5 p-3 rounded-xl border border-white/5">
                          {allCompletedFrames[currentPreviewFrameIndex].cinematographyNotes}
                        </p>
                      </div>
                    )}
                    {allCompletedFrames[currentPreviewFrameIndex].sceneDirectorNotes && (
                      <div className="space-y-1.5 pt-2">
                        <div className="p-4 bg-violet-600/20 rounded-xl border border-violet-500/30 shadow-inner">
                          <p className="text-[10px] font-black text-violet-400 uppercase tracking-[0.2em] mb-2 flex items-center gap-2">
                            <MonitorStop className="w-3 h-3" /> Scene Director's Notes
                          </p>
                          <p className="text-sm text-slate-100 leading-relaxed font-bold">
                            {allCompletedFrames[currentPreviewFrameIndex].sceneDirectorNotes}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div className="p-6 border-t border-white/5 bg-slate-900 shrink-0">
                  <div className="flex items-center justify-between text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                    <span>Resolution: {resolution}</span>
                    <span>Ratio: {storyboard?.aspectRatio === "custom" ? customAspectRatio : storyboard?.aspectRatio}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </DialogContent>{" "}
      </Dialog>{" "}
      <Toaster position="bottom-right" richColors />{" "}
      </div>
    </div>
  );
}
