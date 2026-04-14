import React, { useState, useRef } from "react";
import { analyzePrompt, planStoryboard, generateFrameImage } from "./lib/gemini";
import { Button } from "./components/ui/button";
import { Textarea } from "./components/ui/textarea";
import { Card, CardContent, CardFooter } from "./components/ui/card";
import { Label } from "./components/ui/label";
import { Loader2, RefreshCw, Image as ImageIcon, Check, AlertCircle, Upload, X, Plus, Minus, LayoutTemplate, ArrowRight, Download, FileArchive, Settings2, DownloadCloud, ShieldAlert, Shirt, User, MapPin } from "lucide-react";
import { Toaster } from "./components/ui/sonner";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "./components/ui/alert";
import { motion, AnimatePresence } from "motion/react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent } from "./components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "./components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "./components/ui/radio-group";
import { processImage, downloadBlob, createZip, exportToPDF } from "./lib/imageUtils";

type Frame = {
  frameNumber: number;
  caption: string;
  imagePrompt: string;
  cameraIntent?: string;
  lightingIntent?: string;
  characterExpression?: string;
  costumeDesign?: string;
  cinematographyNotes?: string;
  imageUrl?: string;
  status: "pending" | "generating" | "completed" | "error";
  errorMessage?: string;
  camera?: string;
  lighting?: string;
};

type Character = {
  name: string;
  visualDescription: string;
};

type Scene = {
  sceneNumber: number;
  setting: string;
  description?: string;
  frames: Frame[];
};

type AppState = "idle" | "analyzing" | "needs_improvement" | "planning" | "ready";
type AspectRatio = "16:9" | "9:16" | "1:1" | "4:3" | "3:4" | "custom";
type Resolution = "original" | "720p" | "1080p" | "4k";

export default function App() {
  const [prompt, setPrompt] = useState("");
  const [sampleImage, setSampleImage] = useState<{ url: string; mimeType: string; data: string } | null>(null);
  const [backgroundReferenceImage, setBackgroundReferenceImage] = useState<{ url: string; mimeType: string; data: string } | null>(null);
  const [numScenes, setNumScenes] = useState(2);
  const [framesPerScene, setFramesPerScene] = useState(3);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [customAspectRatio, setCustomAspectRatio] = useState("21:9");
  const [resolution, setResolution] = useState<Resolution>("1080p");
  const [appState, setAppState] = useState<AppState>("idle");
  const [isDownloading, setIsDownloading] = useState(false);
  const [skipAnalysisForCurrentPrompt, setSkipAnalysisForCurrentPrompt] = useState(false);
  const [regeneratingFrame, setRegeneratingFrame] = useState<{sceneIndex: number, frameIndex: number} | null>(null);
  const [selectedCamera, setSelectedCamera] = useState<string>("Default");
  const [selectedLighting, setSelectedLighting] = useState<string>("Default");
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const bgFileInputRef = useRef<HTMLInputElement>(null);
  const [suggestions, setSuggestions] = useState<{prompt: string, explanation: string}[]>([]);
  const [suggestedFrames, setSuggestedFrames] = useState<number | null>(null);
  const [suggestedScenesCount, setSuggestedScenesCount] = useState<number | null>(null);
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
  const [identifiedCharacters, setIdentifiedCharacters] = useState<Character[]>([]);
  const [selectedCharacters, setSelectedCharacters] = useState<string[]>([]);
  
  const [storyboard, setStoryboard] = useState<{
    title: string;
    storySummary: string;
    artStyle: string;
    ambience: string;
    characters: Character[];
    scenes: Scene[];
    aspectRatio: AspectRatio;
  } | null>(null);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: "character" | "background") => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      const base64Data = result.split(",")[1];
      const imgObj = {
        url: result,
        mimeType: file.type,
        data: base64Data,
      };
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
      toast.error("Invalid custom aspect ratio format. Please use W:H (e.g., 21:9).");
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
    
    if (skipAnalysisForCurrentPrompt) {
      setSkipAnalysisForCurrentPrompt(false);
      handlePlan(prompt, identifiedCharacters);
      return;
    }

    setAppState("analyzing");
    try {
      // Add a timeout to prevent hanging
      const analyzePromise = analyzePrompt(prompt, sampleImage);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Analysis timed out. Please try again.")), 60000)
      );
      
      const result = await Promise.race([analyzePromise, timeoutPromise]) as any;
      
      if (!result) {
        throw new Error("Failed to parse analysis result.");
      }

      if (result.isCopyrighted) {
        toast.error("Copyrighted material detected. Please use original concepts.");
        setSuggestions(result.suggestions || []);
        setAnalysis(result.analysis || null);
        setGuide({
          missingElements: ["Original Characters/Story"],
          ingredients: "Originality is key! To comply with copyright policies, we cannot generate protected intellectual property.",
          example: result.copyrightReason || "Instead of 'Batman', try 'A dark, brooding vigilante detective'."
        });
        setAppState("needs_improvement");
        return;
      }

      if (result.analysis) {
        setAnalysis(result.analysis);
        if (result.analysis.numScenes) setSuggestedScenesCount(result.analysis.numScenes);
      } else {
        setAnalysis(null);
      }
      
      if (result.guide) setGuide(result.guide);
      else setGuide(null);

      if (result.identifiedCharacters) {
        setIdentifiedCharacters(result.identifiedCharacters);
        setSelectedCharacters(result.identifiedCharacters.map((c: any) => c.name));
      }

      if (result.status === "good") {
        handlePlan(prompt, result.identifiedCharacters);
      } else {
        setSuggestions(result.suggestions || []);
        setAppState("needs_improvement");
      }
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to analyze prompt.");
      setAppState("idle");
    }
  };

  const getApiAspectRatio = (ratio: AspectRatio, customRatio: string): "16:9" | "9:16" | "1:1" | "4:3" | "3:4" => {
    if (ratio !== "custom") return ratio;
    // For custom, try to guess the closest standard ratio to minimize cropping loss
    const [w, h] = customRatio.split(":").map(Number);
    if (!w || !h) return "16:9";
    const val = w / h;
    if (val > 1.5) return "16:9"; // e.g. 21:9
    if (val > 1.1) return "4:3";
    if (val > 0.9) return "1:1";
    if (val > 0.6) return "3:4";
    return "9:16";
  };

  const handlePlan = async (finalPrompt: string, charactersToUse: Character[] = identifiedCharacters) => {
    setPrompt(finalPrompt);
    setAppState("planning");
    try {
      const planPromise = planStoryboard(finalPrompt, numScenes, framesPerScene, charactersToUse, sampleImage, backgroundReferenceImage);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Storyboard planning timed out. Please try again.")), 60000)
      );
      
      const plan = await Promise.race([planPromise, timeoutPromise]) as any;
      
      const initialScenes: Scene[] = plan.scenes.map((scene: any) => ({
        ...scene,
        frames: scene.frames.map((f: any) => ({
          ...f,
          status: "pending",
        }))
      }));
      
      setStoryboard({
        title: plan.title,
        storySummary: plan.storySummary,
        artStyle: plan.artStyle,
        ambience: plan.ambience || "Standard lighting and mood.",
        characters: plan.characters || [],
        scenes: initialScenes,
        aspectRatio: aspectRatio,
      });
      
      setAppState("ready");
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || "Failed to plan storyboard.");
      setAppState("idle");
    }
  };

  const handleGenerateScene = async (sceneIndex: number) => {
    if (!storyboard) return;
    
    setStoryboard(prev => {
      if (!prev) return prev;
      const newScenes = [...prev.scenes];
      newScenes[sceneIndex] = {
        ...newScenes[sceneIndex],
        frames: newScenes[sceneIndex].frames.map(f => ({ ...f, status: "generating", errorMessage: undefined }))
      };
      return { ...prev, scenes: newScenes };
    });

    const apiRatio = getApiAspectRatio(storyboard.aspectRatio, customAspectRatio);
    const scene = storyboard.scenes[sceneIndex];
    const characterContext = storyboard.characters.map(c => `${c.name}: ${c.visualDescription}`).join(" | ");

    let firstFrameImage: { mimeType: string; data: string } | null = null;

    for (let frameIndex = 0; frameIndex < scene.frames.length; frameIndex++) {
      const frame = scene.frames[frameIndex];
      try {
        const styleManifest = `[VISUAL STYLE MANIFEST] Primary Style: High-end Cinematic Realism (Photorealistic textures, natural lighting). Lighting Model: Global warm sunlight (5500K) with soft ray-traced shadows. No harsh digital gradients. Texture Constraint: Maintain a consistent "Subsurface Scattering" on skin and fur. Anti-Drift Rule: Every frame must maintain the depth, material gloss, and shadow softness established in Scene 1. Atmospheric Consistency: Apply a constant 5% "Volume Fog" to harmonize the foreground and background light.`;
        const backgroundConsistency = `BACKGROUND CONSISTENCY: The background architecture, landscape, and object placement MUST remain EXACTLY the same as described in the Scene Setting. Do not move buildings, trees, or landmarks between frames. DO NOT hallucinate extra characters or objects.`;
        const directorIntent = `DIRECTOR'S INTENT: Camera: ${frame.cameraIntent || "Professional cinematography"}. Lighting: ${frame.lightingIntent || "Cinematic lighting"}. Expression: ${frame.characterExpression || "Natural and story-aligned"}. Costume: ${frame.costumeDesign || "Consistent character attire"}. Cinematography: ${frame.cinematographyNotes || "Balanced composition"}.`;
        const fullPrompt = `${styleManifest} ${backgroundConsistency} ${directorIntent} Art Style: ${storyboard.artStyle}. Ambience/Mood: ${storyboard.ambience}. Scene Setting: ${scene.setting}. Characters: ${characterContext}. Action: ${frame.imagePrompt}`;
        
        let referenceImage = sampleImage;
        let refType: "character" | "composition" | "scene_consistency" = "character";

        if (frameIndex > 0 && firstFrameImage) {
          referenceImage = firstFrameImage;
          refType = "scene_consistency";
        }

        const generatePromise = generateFrameImage(fullPrompt, referenceImage, backgroundReferenceImage, apiRatio as any, refType);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Image generation timed out.")), 45000)
        );
        
        const imageUrl = await Promise.race([generatePromise, timeoutPromise]) as string;
        
        if (frameIndex === 0 && imageUrl) {
          const match = imageUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
          if (match) {
            firstFrameImage = { mimeType: match[1], data: match[2] };
          }
        }
        
        setStoryboard(prev => {
          if (!prev) return prev;
          const newScenes = [...prev.scenes];
          const newFrames = [...newScenes[sceneIndex].frames];
          newFrames[frameIndex] = { ...newFrames[frameIndex], imageUrl, status: "completed" };
          newScenes[sceneIndex] = { ...newScenes[sceneIndex], frames: newFrames };
          return { ...prev, scenes: newScenes };
        });
        
        // Add a small delay between requests to help avoid rate limits
        if (frameIndex < scene.frames.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      } catch (error: any) {
        console.error(`Failed to generate frame ${frame.frameNumber}`, error);
        setStoryboard(prev => {
          if (!prev) return prev;
          const newScenes = [...prev.scenes];
          const newFrames = [...newScenes[sceneIndex].frames];
          newFrames[frameIndex] = { ...newFrames[frameIndex], status: "error", errorMessage: error.message || "Unknown error" };
          newScenes[sceneIndex] = { ...newScenes[sceneIndex], frames: newFrames };
          return { ...prev, scenes: newScenes };
        });
      }
    }
  };

  const handleRegenerateFrame = async (sceneIndex: number, frameIndex: number, cameraControl?: string, lightingControl?: string) => {
    if (!storyboard) return;
    
    // Use provided controls or fall back to current frame's controls or "Default"
    const currentFrame = storyboard.scenes[sceneIndex].frames[frameIndex];
    const finalCamera = cameraControl || currentFrame.camera || "Default";
    const finalLighting = lightingControl || currentFrame.lighting || "Default";

    setStoryboard(prev => {
      if (!prev) return prev;
      const newScenes = [...prev.scenes];
      const newFrames = [...newScenes[sceneIndex].frames];
      newFrames[frameIndex] = { 
        ...newFrames[frameIndex], 
        status: "generating", 
        imageUrl: undefined, 
        errorMessage: undefined,
        camera: finalCamera,
        lighting: finalLighting
      };
      newScenes[sceneIndex] = { ...newScenes[sceneIndex], frames: newFrames };
      return { ...prev, scenes: newScenes };
    });

    const apiRatio = getApiAspectRatio(storyboard.aspectRatio, customAspectRatio);
    const scene = storyboard.scenes[sceneIndex];
    const frame = scene.frames[frameIndex];
    const characterContext = storyboard.characters.map(c => `${c.name}: ${c.visualDescription}`).join(" | ");
    
    const cameraContext = finalCamera !== "Default" ? `Camera: ${finalCamera}. ` : (frame.cameraIntent ? `Camera Intent: ${frame.cameraIntent}. ` : "");
    const lightingContext = finalLighting !== "Default" ? `Lighting: ${finalLighting}. IMPORTANT: Change the shape, size, and direction of shadows of the characters to match this new lighting perfectly. Maintain strict consistency among characters, background, accessories, hair style, and everything else available in the frame. ` : (frame.lightingIntent ? `Lighting Intent: ${frame.lightingIntent}. ` : "");
    const expressionContext = frame.characterExpression ? `Character Expression: ${frame.characterExpression}. ` : "";
    const costumeContext = frame.costumeDesign ? `Costume Design: ${frame.costumeDesign}. ` : "";
    const cinematographyContext = frame.cinematographyNotes ? `Cinematography Notes: ${frame.cinematographyNotes}. ` : "";
    
    const styleManifest = `[VISUAL STYLE MANIFEST] Primary Style: High-end Cinematic Realism (Photorealistic textures, natural lighting). Lighting Model: Global warm sunlight (5500K) with soft ray-traced shadows. No harsh digital gradients. Texture Constraint: Maintain a consistent "Subsurface Scattering" on skin and fur. Anti-Drift Rule: Every frame must maintain the depth, material gloss, and shadow softness established in Scene 1. Atmospheric Consistency: Apply a constant 5% "Volume Fog" to harmonize the foreground and background light.`;
    const fullPrompt = `${styleManifest} Art Style: ${storyboard.artStyle}. Ambience/Mood: ${storyboard.ambience}. Scene Setting: ${scene.setting}. Characters: ${characterContext}. ${cameraContext}${lightingContext}${expressionContext}${costumeContext}${cinematographyContext}Action: ${frame.imagePrompt}`;

    let referenceImage = sampleImage;
    let refType: "character" | "composition" = "character";

    if (currentFrame.imageUrl) {
      const match = currentFrame.imageUrl.match(/^data:(image\/[a-zA-Z+]+);base64,(.+)$/);
      if (match) {
        referenceImage = {
          mimeType: match[1],
          data: match[2]
        };
        refType = "composition";
      }
    }

    try {
      const generatePromise = generateFrameImage(fullPrompt, referenceImage, backgroundReferenceImage, apiRatio as any, refType);
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Image generation timed out.")), 45000)
      );
      
      const imageUrl = await Promise.race([generatePromise, timeoutPromise]) as string;
      
      setStoryboard(prev => {
        if (!prev) return prev;
        const newScenes = [...prev.scenes];
        const newFrames = [...newScenes[sceneIndex].frames];
        newFrames[frameIndex] = { ...newFrames[frameIndex], imageUrl, status: "completed" };
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], frames: newFrames };
        return { ...prev, scenes: newScenes };
      });
    } catch (error: any) {
      console.error(`Failed to regenerate frame ${frame.frameNumber}`, error);
      setStoryboard(prev => {
        if (!prev) return prev;
        const newScenes = [...prev.scenes];
        const newFrames = [...newScenes[sceneIndex].frames];
        newFrames[frameIndex] = { ...newFrames[frameIndex], status: "error", errorMessage: error.message || "Unknown error" };
        newScenes[sceneIndex] = { ...newScenes[sceneIndex], frames: newFrames };
        return { ...prev, scenes: newScenes };
      });
      toast.error(`Failed to regenerate frame ${frame.frameNumber}`);
    }
  };

  const handleDownloadFrame = async (frame: Frame, format: "png" | "jpeg" = "png") => {
    if (!frame.imageUrl) return;
    try {
      setIsDownloading(true);
      toast.info(`Preparing frame ${frame.frameNumber} for download...`);
      const { blob } = await processImage(frame.imageUrl, resolution, customAspectRatio, format);
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
    try {
      setIsDownloading(true);
      toast.info("Preparing storyboard PDF file...");
      const pdfBlob = await exportToPDF(storyboard, resolution, customAspectRatio);
      downloadBlob(pdfBlob, `${storyboard.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-storyboard.pdf`);
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
      toast.info("Preparing storyboard ZIP file...");
      const files = [];
      for (const scene of storyboard.scenes) {
        for (const frame of scene.frames) {
          if (frame.imageUrl && frame.status === "completed") {
            const { blob } = await processImage(frame.imageUrl, resolution, customAspectRatio, "png");
            files.push({ name: `scene-${scene.sceneNumber}-frame-${String(frame.frameNumber).padStart(2, '0')}.png`, blob });
          }
        }
      }
      if (files.length === 0) {
        toast.error("No completed frames to download.");
        return;
      }
      const zipBlob = await createZip(files);
      downloadBlob(zipBlob, `${storyboard.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}-storyboard.zip`);
      toast.success("Storyboard downloaded successfully!");
    } catch (error) {
      console.error(error);
      toast.error("Failed to create ZIP file.");
    } finally {
      setIsDownloading(false);
    }
  };

  const getAspectRatioClass = (ratio: AspectRatio) => {
    switch (ratio) {
      case "16:9": return "aspect-video";
      case "9:16": return "aspect-[9/16]";
      case "1:1": return "aspect-square";
      default: return "aspect-video";
    }
  };

  return (
    <div className="min-h-screen bg-zinc-50 text-zinc-900 font-sans pb-20 selection:bg-indigo-200">
      <Toaster position="top-center" />
      
      <header className="bg-white/80 backdrop-blur-md border-b border-zinc-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-md flex items-center justify-center shadow-inner">
              <ImageIcon className="w-5 h-5 text-white" />
            </div>
            <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">StoryFrames</h1>
          </div>
          <div className="flex items-center gap-3">
            {appState === "ready" && storyboard?.scenes.some(s => s.frames.some(f => f.status === "completed")) && (
              <>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleDownloadPDF} 
                  disabled={isDownloading}
                  className="bg-white hover:bg-zinc-50 text-zinc-700 shadow-sm"
                >
                  {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <DownloadCloud className="w-4 h-4 mr-2" />}
                  Export PDF
                </Button>
                <Button 
                  variant="default" 
                  size="sm" 
                  onClick={handleDownloadAll} 
                  disabled={isDownloading}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm"
                >
                  {isDownloading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileArchive className="w-4 h-4 mr-2" />}
                  Download ZIP
                </Button>
              </>
            )}
            {appState === "ready" && (
              <Button variant="outline" size="sm" onClick={() => {
                setAppState("idle");
                setPrompt("");
                setSampleImage(null);
                setStoryboard(null);
              }} className="hover:bg-indigo-50 hover:text-indigo-600 transition-colors">
                New Storyboard
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8">
        <AnimatePresence mode="wait">
          {appState === "idle" && (
            <motion.div 
              key="idle"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.4 }}
              className="max-w-2xl mx-auto space-y-8"
            >
              <div className="text-center space-y-2">
                <h2 className="text-4xl font-bold tracking-tight text-zinc-800">What's your story?</h2>
                <p className="text-zinc-500 text-lg">Describe your scene, characters, and mood. We'll handle the rest.</p>
              </div>

              <Card className="border-zinc-200 shadow-xl shadow-indigo-100/50 overflow-hidden">
                <div className="h-1 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500" />
                <CardContent className="p-6 space-y-8">
                  <div className="space-y-3">
                    <Label htmlFor="prompt" className="text-sm font-semibold text-zinc-700">Story Prompt</Label>
                    <div className="relative">
                      <Textarea 
                        id="prompt"
                        placeholder="Paste your story idea here... Our pre-production team (Script Writer, Director, Cinematographer, etc.) will finalize it into a professional storyboard."
                        className="min-h-[120px] resize-none text-base focus-visible:ring-indigo-500 pr-10"
                        value={prompt}
                        maxLength={3000}
                        onChange={(e) => {
                          setPrompt(e.target.value);
                          setSkipAnalysisForCurrentPrompt(false);
                        }}
                      />
                      {prompt && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="absolute top-2 right-2 h-6 w-6 text-zinc-400 hover:text-zinc-600 bg-white/80 hover:bg-zinc-100 rounded-full"
                          onClick={() => {
                            setPrompt("");
                            setSkipAnalysisForCurrentPrompt(false);
                          }}
                          title="Clear prompt"
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-zinc-700">Character Reference (Optional)</Label>
                      <div className="flex items-center gap-4">
                        {sampleImage ? (
                          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full h-24 rounded-xl overflow-hidden border-2 border-indigo-100 shadow-sm">
                            <img src={sampleImage.url} alt="Character Reference" className="w-full h-full object-cover" />
                            <button 
                              onClick={() => setSampleImage(null)}
                              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </motion.div>
                        ) : (
                          <Button 
                            variant="outline" 
                            className="w-full h-24 border-dashed border-2 border-zinc-200 text-zinc-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                            onClick={() => fileInputRef.current?.click()}
                          >
                            <User className="w-5 h-5 mr-2" />
                            Upload Character
                          </Button>
                        )}
                        <input 
                          type="file" 
                          ref={fileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={(e) => handleImageUpload(e, "character")} 
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500">Upload an image to maintain character identity.</p>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-zinc-700">Background Reference (Optional)</Label>
                      <div className="flex items-center gap-4">
                        {backgroundReferenceImage ? (
                          <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative w-full h-24 rounded-xl overflow-hidden border-2 border-indigo-100 shadow-sm">
                            <img src={backgroundReferenceImage.url} alt="Background Reference" className="w-full h-full object-cover" />
                            <button 
                              onClick={() => setBackgroundReferenceImage(null)}
                              className="absolute top-1 right-1 bg-black/50 text-white rounded-full p-1 hover:bg-black/70 transition-colors"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </motion.div>
                        ) : (
                          <Button 
                            variant="outline" 
                            className="w-full h-24 border-dashed border-2 border-zinc-200 text-zinc-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/50 transition-all"
                            onClick={() => bgFileInputRef.current?.click()}
                          >
                            <MapPin className="w-5 h-5 mr-2" />
                            Upload Background
                          </Button>
                        )}
                        <input 
                          type="file" 
                          ref={bgFileInputRef} 
                          className="hidden" 
                          accept="image/*" 
                          onChange={(e) => handleImageUpload(e, "background")} 
                        />
                      </div>
                      <p className="text-[10px] text-zinc-500">Upload a location reference (e.g., Sarojini Nagar).</p>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 mt-2 text-xs text-zinc-500 bg-zinc-100/50 p-2.5 rounded-md border border-zinc-200/50">
                    <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                    <p>Please avoid using copyrighted characters or franchises (e.g., Marvel, Disney). The system restricts generation of protected intellectual property and will adapt them into generic concepts.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 pt-2">
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-zinc-700">Aspect Ratio</Label>
                      <Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as AspectRatio)}>
                        <SelectTrigger className="w-full h-11 bg-zinc-50 border-zinc-200">
                          <SelectValue placeholder="Select aspect ratio" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="16:9">16:9 (Landscape)</SelectItem>
                          <SelectItem value="9:16">9:16 (Portrait)</SelectItem>
                          <SelectItem value="1:1">1:1 (Square)</SelectItem>
                          <SelectItem value="4:3">4:3 (Standard)</SelectItem>
                          <SelectItem value="3:4">3:4 (Vertical)</SelectItem>
                          <SelectItem value="custom">Custom...</SelectItem>
                        </SelectContent>
                      </Select>
                      {aspectRatio === "custom" && (
                        <div className="flex items-center gap-2 mt-2">
                          <input 
                            type="text" 
                            value={customAspectRatio} 
                            onChange={(e) => setCustomAspectRatio(e.target.value)}
                            placeholder="e.g. 21:9"
                            className="w-full h-9 px-3 text-sm rounded-md border border-zinc-200 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                      )}
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-zinc-700">Resolution</Label>
                      <Select value={resolution} onValueChange={(v) => setResolution(v as Resolution)}>
                        <SelectTrigger className="w-full h-11 bg-zinc-50 border-zinc-200">
                          <SelectValue placeholder="Select resolution" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="original">Original (Fastest)</SelectItem>
                          <SelectItem value="720p">720p (HD)</SelectItem>
                          <SelectItem value="1080p">1080p (Full HD)</SelectItem>
                          <SelectItem value="4k">4K (Ultra HD)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-zinc-700">Scenes</Label>
                      <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl p-1 h-11">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-lg hover:bg-white hover:shadow-sm transition-all" 
                          onClick={() => setNumScenes(Math.max(1, numScenes - 1))}
                          disabled={numScenes <= 1}
                        >
                          <Minus className="w-4 h-4 text-zinc-600" />
                        </Button>
                        <div className="flex items-center justify-center">
                          <span className="text-lg font-bold text-zinc-800 tabular-nums">{numScenes}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-lg hover:bg-white hover:shadow-sm transition-all" 
                          onClick={() => setNumScenes(Math.min(10, numScenes + 1))}
                          disabled={numScenes >= 10}
                        >
                          <Plus className="w-4 h-4 text-zinc-600" />
                        </Button>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <Label className="text-sm font-semibold text-zinc-700">Frames per Scene</Label>
                      <div className="flex items-center justify-between bg-zinc-50 border border-zinc-200 rounded-xl p-1 h-11">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-lg hover:bg-white hover:shadow-sm transition-all" 
                          onClick={() => setFramesPerScene(Math.max(1, framesPerScene - 1))}
                          disabled={framesPerScene <= 1}
                        >
                          <Minus className="w-4 h-4 text-zinc-600" />
                        </Button>
                        <div className="flex items-center justify-center">
                          <span className="text-lg font-bold text-zinc-800 tabular-nums">{framesPerScene}</span>
                        </div>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-9 w-9 rounded-lg hover:bg-white hover:shadow-sm transition-all" 
                          onClick={() => setFramesPerScene(Math.min(10, framesPerScene + 1))}
                          disabled={framesPerScene >= 10}
                        >
                          <Plus className="w-4 h-4 text-zinc-600" />
                        </Button>
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="bg-zinc-50/80 border-t border-zinc-100 p-6">
                  <Button 
                    className="w-full text-base h-12 font-semibold bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white shadow-lg shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98]" 
                    onClick={handleAnalyze}
                  >
                    Generate Storyboard
                  </Button>
                </CardFooter>
              </Card>
            </motion.div>
          )}

          {appState === "analyzing" && (
            <motion.div 
              key="analyzing"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-32 space-y-6"
            >
              <div className="relative">
                <div className="absolute inset-0 bg-indigo-500 blur-xl opacity-20 rounded-full animate-pulse" />
                <Loader2 className="w-10 h-10 animate-spin text-indigo-600 relative z-10" />
              </div>
              <p className="text-zinc-600 font-medium text-lg">Analyzing prompt quality...</p>
            </motion.div>
          )}

          {appState === "needs_improvement" && (
            <motion.div 
              key="needs_improvement"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="max-w-2xl mx-auto space-y-6"
            >
              <Alert className="bg-amber-50 border-amber-200 text-amber-900 shadow-sm">
                <AlertCircle className="h-5 w-5 text-amber-600" />
                <AlertTitle className="font-bold text-amber-800 text-base">Prompt Analysis Results</AlertTitle>
                <AlertDescription className="text-amber-700/90 mt-1.5 text-sm">
                  We've analyzed your prompt based on key storytelling parameters. Review the analysis and suggestions below.
                </AlertDescription>
              </Alert>

              {analysis && (
                <Card className="border-zinc-200 shadow-sm overflow-hidden">
                  <div className="bg-zinc-50 px-5 py-3 border-b border-zinc-200">
                    <h3 className="text-sm font-bold text-zinc-700 uppercase tracking-wider">Story Parameters</h3>
                  </div>
                  <CardContent className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Suggested Title</span>
                      <p className="text-sm font-medium text-zinc-800">{analysis.title}</p>
                    </div>
                    <div className="space-y-1">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Characters / Scenes</span>
                      <p className="text-sm font-medium text-zinc-800">{analysis.numCharacters} Characters | {analysis.numScenes} Scenes</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Objective</span>
                      <p className="text-sm text-zinc-700 leading-relaxed">{analysis.objective}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2">
                      <span className="text-xs font-bold text-zinc-400 uppercase tracking-widest">Core Message</span>
                      <p className="text-sm text-zinc-700 leading-relaxed">{analysis.message}</p>
                    </div>
                    <div className="space-y-1 md:col-span-2 pt-2 border-t border-zinc-100">
                      <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Consistency Check</span>
                      <p className="text-sm text-zinc-700 italic leading-relaxed">"{analysis.consistencyCheck}"</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              {guide && (
                <Card className="border-amber-200 shadow-sm overflow-hidden bg-amber-50/50">
                  <div className="bg-amber-100/50 px-5 py-3 border-b border-amber-200">
                    <h3 className="text-sm font-bold text-amber-800 uppercase tracking-wider">How to write a better prompt</h3>
                  </div>
                  <CardContent className="p-5 space-y-4">
                    {guide.missingElements && guide.missingElements.length > 0 && (
                      <div>
                        <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Missing Elements</span>
                        <div className="flex flex-wrap gap-2 mt-2">
                          {guide.missingElements.map((el, i) => (
                            <span key={i} className="bg-amber-100 text-amber-800 text-xs px-2 py-1 rounded-md font-medium">{el}</span>
                          ))}
                        </div>
                      </div>
                    )}
                    <div>
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Ingredients of a Good Prompt</span>
                      <p className="text-sm text-amber-900 mt-1 leading-relaxed">{guide.ingredients}</p>
                    </div>
                    <div className="bg-white/60 p-3 rounded-lg border border-amber-200/50">
                      <span className="text-xs font-bold text-amber-700 uppercase tracking-widest">Example</span>
                      <p className="text-sm text-amber-900 mt-1 italic">"{guide.example}"</p>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="space-y-4">
                {identifiedCharacters.length > 0 && (
                  <div className="space-y-4 mb-6">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Identified Characters</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {identifiedCharacters.map((char, i) => (
                        <div key={i} className="flex items-center gap-3 bg-zinc-50 p-3 rounded-xl border border-zinc-100">
                          <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                            {char.name[0]}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-zinc-800">{char.name}</p>
                            <p className="text-xs text-zinc-500 line-clamp-1">{char.visualDescription}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Suggested Improvements</h3>
                
                {suggestions.map((s, i) => (
                  <motion.div key={i} whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}>
                    <Card 
                      className="border-zinc-200 hover:border-indigo-300 hover:shadow-md transition-all cursor-pointer overflow-hidden group" 
                      onClick={() => {
                        setPrompt(s.prompt);
                        setSkipAnalysisForCurrentPrompt(true);
                        setAppState("idle");
                        toast.success("Prompt updated! Click Generate to proceed directly to planning.");
                      }}
                    >
                      <div className="h-0.5 w-0 bg-indigo-500 group-hover:w-full transition-all duration-500" />
                      <CardContent className="p-5 space-y-3">
                        <p className="text-zinc-900 font-medium leading-relaxed">{s.prompt}</p>
                        <div className="flex items-start gap-2 bg-green-50 text-green-700 p-2.5 rounded-md text-sm">
                          <Check className="w-4 h-4 mt-0.5 shrink-0" />
                          <span>{s.explanation}</span>
                        </div>
                        <div className="pt-1 flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                          <span className="text-xs font-bold text-indigo-600 flex items-center gap-1">
                            Use this prompt <ArrowRight className="w-3 h-3" />
                          </span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              <div className="flex items-center gap-4 pt-6 border-t border-zinc-200">
                <Button variant="outline" className="flex-1 h-11 font-medium" onClick={() => setAppState("idle")}>
                  Edit Original Prompt
                </Button>
                <Button variant="secondary" className="flex-1 h-11 font-medium bg-zinc-800 text-white hover:bg-zinc-700" onClick={() => handlePlan(prompt, identifiedCharacters)}>
                  Proceed Anyway
                </Button>
              </div>
            </motion.div>
          )}

          {(appState === "planning" || appState === "ready") && storyboard && (
            <motion.div 
              key="storyboard"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="space-y-8"
            >
              <div className="bg-white rounded-2xl border border-zinc-200 p-6 shadow-sm relative overflow-hidden">
                <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-full blur-3xl -z-10 transform translate-x-1/2 -translate-y-1/2" />
                <h2 className="text-2xl font-bold tracking-tight mb-2 text-zinc-900">{storyboard.title}</h2>
                <p className="text-zinc-600 mb-6 leading-relaxed">{storyboard.storySummary}</p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                    <span className="text-xs font-bold text-indigo-600 uppercase tracking-wider block mb-1.5">Art Style</span>
                    <p className="text-zinc-700 leading-relaxed">{storyboard.artStyle}</p>
                  </div>
                  <div className="bg-zinc-50 p-4 rounded-xl border border-zinc-100">
                    <span className="text-xs font-bold text-purple-600 uppercase tracking-wider block mb-1.5">Characters</span>
                    <div className="space-y-2">
                      {storyboard.characters.map((char, idx) => (
                        <div key={idx} className="text-zinc-700 leading-relaxed">
                          <span className="font-semibold">{char.name}:</span> {char.visualDescription}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {appState === "planning" && (
                <div className="flex flex-col items-center justify-center py-24 space-y-6">
                  <div className="relative">
                    <div className="absolute inset-0 bg-purple-500 blur-xl opacity-20 rounded-full animate-pulse" />
                    <LayoutTemplate className="w-10 h-10 animate-pulse text-purple-600 relative z-10" />
                  </div>
                  <p className="text-zinc-600 font-medium text-lg">Planning scene compositions...</p>
                </div>
              )}

              {appState === "ready" && (
                <div className="space-y-12">
                  {storyboard.scenes.map((scene, sceneIndex) => (
                    <div key={sceneIndex} className="space-y-6">
                      <div className="flex items-center gap-4">
                        <h3 className="text-xl font-bold text-zinc-800">Scene {scene.sceneNumber}</h3>
                        <div className="h-px bg-zinc-200 flex-1" />
                        <span className="text-sm font-medium text-zinc-500 bg-zinc-100 px-3 py-1 rounded-full">{scene.setting}</span>
                        {scene.frames.some(f => f.status === "pending" || f.status === "error") && (
                          <Button 
                            size="sm" 
                            className="bg-indigo-600 hover:bg-indigo-700 text-white"
                            onClick={() => handleGenerateScene(sceneIndex)}
                            disabled={scene.frames.some(f => f.status === "generating")}
                          >
                            {scene.frames.some(f => f.status === "generating") ? (
                              <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating...</>
                            ) : (
                              <><ImageIcon className="w-4 h-4 mr-2" /> Generate Scene</>
                            )}
                          </Button>
                        )}
                      </div>
                      {scene.description && <p className="text-zinc-600 text-sm">{scene.description}</p>}
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {scene.frames.map((frame, frameIndex) => (
                          <motion.div 
                            key={frameIndex}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: frameIndex * 0.1 }}
                          >
                            <Card className="overflow-hidden border-zinc-200 shadow-md hover:shadow-lg transition-shadow duration-300 flex flex-col h-full bg-white rounded-2xl">
                              <div className={`relative ${getAspectRatioClass(storyboard.aspectRatio)} bg-zinc-100 flex items-center justify-center overflow-hidden border-b border-zinc-100`}>
                                {frame.status === "pending" && (
                                  <div className="flex flex-col items-center gap-3 text-zinc-400 p-6 text-center bg-zinc-50 w-full h-full justify-center">
                                    <ImageIcon className="w-8 h-8 opacity-50" />
                                    <span className="text-sm font-medium">Ready to Generate</span>
                                  </div>
                                )}

                                {frame.status === "generating" && (
                                  <div className="flex flex-col items-center gap-4">
                                    <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
                                    <span className="text-xs font-bold text-indigo-600/70 uppercase tracking-widest bg-indigo-50 px-3 py-1 rounded-full">Generating Frame {frame.frameNumber}</span>
                                  </div>
                                )}
                                
                                {frame.status === "error" && (
                                  <div className="flex flex-col items-center gap-3 text-red-500 p-6 text-center bg-red-50 w-full h-full justify-center">
                                    <AlertCircle className="w-8 h-8" />
                                    <span className="text-sm font-bold uppercase tracking-wider">Generation Failed</span>
                                    <span className="text-xs text-red-400 max-w-[90%] line-clamp-3" title={frame.errorMessage}>{frame.errorMessage}</span>
                                  </div>
                                )}

                                {frame.status === "completed" && frame.imageUrl && (
                                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }} className="w-full h-full">
                                    <img 
                                      src={frame.imageUrl} 
                                      alt={`Frame ${frame.frameNumber}`} 
                                      className="w-full h-full object-cover"
                                      referrerPolicy="no-referrer"
                                    />
                                    {/* Small, discreet frame number in the corner */}
                                    <div className="absolute bottom-3 right-3 bg-black/50 backdrop-blur-md text-white/90 text-xs font-mono px-2 py-1 rounded-md select-none pointer-events-none shadow-sm">
                                      {String(frame.frameNumber).padStart(2, '0')}
                                    </div>
                                  </motion.div>
                                )}
                              </div>
                              
                              <CardContent className="p-5 flex-1 flex flex-col justify-between gap-5">
                                  <div className="space-y-4">
                                    <p className="text-sm font-medium text-zinc-800 leading-relaxed italic">"{frame.caption}"</p>
                                    
                                    {(frame.cameraIntent || frame.characterExpression || frame.lightingIntent || frame.costumeDesign || frame.cinematographyNotes) && (
                                      <div className="grid grid-cols-1 gap-3 pt-3 border-t border-zinc-100">
                                        {frame.cameraIntent && (
                                          <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-indigo-50 rounded-md text-indigo-600">
                                              <Settings2 className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="space-y-0.5">
                                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Camera</p>
                                              <p className="text-xs text-zinc-600 leading-tight">{frame.cameraIntent}</p>
                                            </div>
                                          </div>
                                        )}
                                        {frame.lightingIntent && (
                                          <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-amber-50 rounded-md text-amber-600">
                                              <RefreshCw className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="space-y-0.5">
                                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Lighting</p>
                                              <p className="text-xs text-zinc-600 leading-tight">{frame.lightingIntent}</p>
                                            </div>
                                          </div>
                                        )}
                                        {frame.characterExpression && (
                                          <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-purple-50 rounded-md text-purple-600">
                                              <RefreshCw className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="space-y-0.5">
                                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Expression</p>
                                              <p className="text-xs text-zinc-600 leading-tight">{frame.characterExpression}</p>
                                            </div>
                                          </div>
                                        )}
                                        {frame.costumeDesign && (
                                          <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-rose-50 rounded-md text-rose-600">
                                              <Shirt className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="space-y-0.5">
                                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Costume</p>
                                              <p className="text-xs text-zinc-600 leading-tight">{frame.costumeDesign}</p>
                                            </div>
                                          </div>
                                        )}
                                        {frame.cinematographyNotes && (
                                          <div className="flex items-start gap-2.5">
                                            <div className="p-1.5 bg-zinc-50 rounded-md text-zinc-600">
                                              <LayoutTemplate className="w-3.5 h-3.5" />
                                            </div>
                                            <div className="space-y-0.5">
                                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Cinematography</p>
                                              <p className="text-xs text-zinc-600 leading-tight">{frame.cinematographyNotes}</p>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                
                                <div className="flex justify-end gap-2 pt-2 border-t border-zinc-100">
                                  {frame.status === "completed" && (
                                    <DropdownMenu>
                                      <DropdownMenuTrigger render={
                                        <Button 
                                          variant="ghost" 
                                          size="sm" 
                                          className="h-8 text-xs font-medium text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                          disabled={isDownloading}
                                        >
                                          <Download className="w-3.5 h-3.5 mr-2" />
                                          Download
                                        </Button>
                                      } />
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => handleDownloadFrame(frame, "png")}>
                                          Download as PNG
                                        </DropdownMenuItem>
                                        <DropdownMenuItem onClick={() => handleDownloadFrame(frame, "jpeg")}>
                                          Download as JPG
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  )}
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    className="h-8 text-xs font-medium text-zinc-500 hover:text-indigo-600 hover:bg-indigo-50 transition-colors"
                                    disabled={frame.status === "generating"}
                                    onClick={() => {
                                      setRegeneratingFrame({ sceneIndex, frameIndex });
                                      setSelectedCamera(frame.camera || "Default");
                                      setSelectedLighting(frame.lighting || "Default");
                                    }}
                                  >
                                    <RefreshCw className={`w-3.5 h-3.5 mr-2 ${frame.status === "generating" ? "animate-spin" : ""}`} />
                                    Regenerate
                                  </Button>
                                </div>
                              </CardContent>
                            </Card>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <Dialog open={!!regeneratingFrame} onOpenChange={(open) => !open && setRegeneratingFrame(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Regenerate Frame</DialogTitle>
          </DialogHeader>
          <div className="grid gap-6 py-4">
            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">Camera Angle</h4>
              <RadioGroup value={selectedCamera} onValueChange={setSelectedCamera} className="grid grid-cols-2 gap-2">
                {["Default", "Zoom in", "Zoom out", "Cinematic", "Panoramic", "Over the shoulder", "Birds eye"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`camera-${option}`} />
                    <Label htmlFor={`camera-${option}`} className="text-sm font-normal cursor-pointer">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
            <div className="space-y-4">
              <h4 className="text-sm font-medium leading-none">Lighting Condition</h4>
              <RadioGroup value={selectedLighting} onValueChange={setSelectedLighting} className="grid grid-cols-2 gap-2">
                {["Default", "Golden hour", "Blue hour", "High noon", "Silvery night", "Soft diffused light", "Dramatic chiaroscuro", "Cinematic neon"].map((option) => (
                  <div key={option} className="flex items-center space-x-2">
                    <RadioGroupItem value={option} id={`lighting-${option}`} />
                    <Label htmlFor={`lighting-${option}`} className="text-sm font-normal cursor-pointer">{option}</Label>
                  </div>
                ))}
              </RadioGroup>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRegeneratingFrame(null)}>Cancel</Button>
            <Button onClick={() => {
              if (regeneratingFrame) {
                handleRegenerateFrame(regeneratingFrame.sceneIndex, regeneratingFrame.frameIndex, selectedCamera, selectedLighting);
                setRegeneratingFrame(null);
              }
            }}>Regenerate</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Toaster position="bottom-right" richColors />
    </div>
  );
}
