import JSZip from "jszip";
import { jsPDF } from "jspdf";

export async function processImage(
  base64Data: string,
  targetResolution: "original" | "720p" | "1080p" | "4k",
  targetAspectRatio: string | "original",
  format: "png" | "jpeg" = "png"
): Promise<{ blob: Blob; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      let targetWidth = img.width;
      let targetHeight = img.height;

      // 1. Handle Aspect Ratio Cropping
      const isOriginalRatio = targetAspectRatio === "original";
      const [ratioW, ratioH] = isOriginalRatio ? [img.width, img.height] : targetAspectRatio.split(":").map(Number);
      
      if (!isOriginalRatio && ratioW && ratioH) {
        const targetRatio = ratioW / ratioH;
        const currentRatio = img.width / img.height;

        if (Math.abs(targetRatio - currentRatio) > 0.01) {
          // Need to crop
          if (currentRatio > targetRatio) {
            // Image is too wide, crop width
            targetWidth = img.height * targetRatio;
          } else {
            // Image is too tall, crop height
            targetHeight = img.width / targetRatio;
          }
        }
      }

      // 2. Handle Resolution Scaling
      let finalWidth = targetWidth;
      let finalHeight = targetHeight;

      if (targetResolution !== "original") {
        const isLandscape = finalWidth >= finalHeight;
        let maxDim = 1024;
        if (targetResolution === "720p") maxDim = 1280;
        if (targetResolution === "1080p") maxDim = 1920;
        if (targetResolution === "4k") maxDim = 3840;

        const currentProcRatio = targetWidth / targetHeight;

        if (isLandscape) {
          finalWidth = maxDim;
          finalHeight = Math.round(maxDim / currentProcRatio);
        } else {
          finalHeight = maxDim;
          finalWidth = Math.round(maxDim * currentProcRatio);
        }
      }

      const canvas = document.createElement("canvas");
      canvas.width = finalWidth;
      canvas.height = finalHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Failed to get canvas context"));
        return;
      }

      // Calculate crop source coordinates (center crop)
      const srcX = (img.width - targetWidth) / 2;
      const srcY = (img.height - targetHeight) / 2;

      ctx.drawImage(
        img,
        srcX,
        srcY,
        targetWidth,
        targetHeight,
        0,
        0,
        finalWidth,
        finalHeight
      );

      canvas.toBlob(
        (blob) => {
          if (blob) resolve({ blob, width: finalWidth, height: finalHeight });
          else reject(new Error("Failed to create blob"));
        },
        `image/${format}`,
        0.95
      );
    };
    img.onerror = () => reject(new Error("Failed to load image for processing"));
    img.src = base64Data;
  });
}

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export async function createZip(files: { name: string; blob: Blob }[]): Promise<Blob> {
  const zip = new JSZip();
  files.forEach((file) => {
    zip.file(file.name, file.blob);
  });
  return zip.generateAsync({ type: "blob" });
}

export async function exportToCSV(storyboard: any): Promise<Blob> {
  // Pre-production and Review Tracking columns for professional studio setups (e.g. ShotGrid, StudioBinder)
  const headers = [
    "Scene",
    "Shot",
    "Status", // Validation Loop: Pending, WIP, Internal Review, Client Review, Approved
    "Priority", // Low, Med, High, Critical
    "Caption / Action",
    "Location Setting",
    "Camera Intent",
    "Lighting Intent",
    "Character Expression",
    "Costume / Wardrobe",
    "Director's Notes",
    "Reviewer Comments", // Validation Loop: For feedback
    "Approved By", // Validation Loop: Role/Name
    "Image Asset Link"
  ];
  
  const rows = [headers];
  
  const sanitize = (text: string) => {
    if (!text) return "";
    // Replace newlines with spaces to avoid breaking CSV rows if opened in basic editors,
    // though proper quotes (which we use) should handle it. It's safer to strip them.
    let cleaned = text.replace(/[\n\r]+/g, ' ').replace(/"/g, '""');
    return `"${cleaned}"`;
  };

  storyboard.scenes.forEach((scene: any) => {
    scene.frames.forEach((frame: any) => {
      rows.push([
        scene.sceneNumber.toString(),
        frame.frameNumber.toString(),
        `"Pending"`, // Default status for validation loop
        `"Medium"`,  // Default priority
        sanitize(frame.caption),
        sanitize(scene.setting),
        sanitize(frame.camera && frame.camera !== "Default" ? frame.camera : frame.cameraIntent),
        sanitize(frame.lighting && frame.lighting !== "Default" ? frame.lighting : frame.lightingIntent),
        sanitize(frame.characterExpression),
        sanitize(frame.costumeDesign),
        sanitize(frame.cinematographyNotes),
        `""`, // Reviewer Comments placeholder
        `""`, // Approved By placeholder
        frame.imageUrl ? `"data:image/png;base64,..."` : "" // Don't export massive base64 strings to CSV, it breaks Excel completely.
      ]);
    });
  });
  
  const csvContent = rows.map(r => r.join(",")).join("\n");
  
  // Add UTF-8 BOM (Byte Order Mark) at the beginning so Excel opens it with correct encoding automatically
  const bom = new Uint8Array([0xEF, 0xBB, 0xBF]);
  return new Blob([bom, csvContent], { type: "text/csv;charset=utf-8;" });
}

export interface PDFPromptInfo {
  originalPrompt: string;
  hasCharacterReference: boolean;
  hasBackgroundReference: boolean;
  selectedStyle: string;
}

export async function exportToPDF(storyboard: any, promptInfo: PDFPromptInfo, resolution: "original" | "720p" | "1080p" | "4k", aspectRatio: string, onProgress?: (progress: number) => void): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  doc.setFontSize(22);
  doc.text(storyboard.title || "Storyboard", margin, 20);
  
  // Add Date and Time
  const now = new Date();
  const dateStr = now.toLocaleDateString() + ' ' + now.toLocaleTimeString();
  doc.setFontSize(8);
  doc.setTextColor(150, 150, 150);
  doc.text(`Generated on: ${dateStr}`, margin, 25);
  
  doc.setFontSize(12);
  doc.setTextColor(60, 60, 60);
  const splitSummary = doc.splitTextToSize(storyboard.storySummary || "", contentWidth);
  doc.text(splitSummary, margin, 32);
  
  let yPos = 32 + (splitSummary.length * 6) + 12;

  // Render Input/Reference Information block
  doc.setFillColor(245, 245, 245);
  doc.setDrawColor(200, 200, 200);
  
  doc.setFontSize(10);
  doc.setTextColor(30, 30, 30);
  
  const promptText = `Original Input Prompt: "${promptInfo.originalPrompt}"`;
  const splitPromptInfo = doc.splitTextToSize(promptText, contentWidth - 10);
  
  const refText = `References Used: ${promptInfo.hasCharacterReference ? '[✓] Character Reference' : '[ ] No Character Reference'} | ${promptInfo.hasBackgroundReference ? '[✓] Background Reference' : '[ ] No Background Reference'}\nChosen Style: ${promptInfo.selectedStyle}`;
  const splitRefInfo = doc.splitTextToSize(refText, contentWidth - 10);
  
  const totalBoxHeight = (splitPromptInfo.length * 5) + (splitRefInfo.length * 5) + 16;
  
  // Draw the rounded box
  doc.roundedRect(margin, yPos, contentWidth, totalBoxHeight, 2, 2, 'FD');
  
  // Draw text inside box
  doc.setFont("helvetica", "italic");
  doc.text(splitPromptInfo, margin + 5, yPos + 8);
  doc.setFont("helvetica", "bold");
  doc.text(splitRefInfo, margin + 5, yPos + 12 + (splitPromptInfo.length * 5));
  doc.setFont("helvetica", "normal");
  
  yPos += totalBoxHeight + 15;
  doc.setTextColor(0, 0, 0);

  const totalFrames = storyboard.scenes.reduce((acc: number, s: any) => acc + s.frames.length, 0);
  let processedCount = 0;

  for (let sIdx = 0; sIdx < storyboard.scenes.length; sIdx++) {
    const scene = storyboard.scenes[sIdx];
    
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(16);
    doc.text(`Scene ${sIdx + 1}`, margin, yPos);
    yPos += 8;
    
    doc.setFontSize(10);
    const splitSetting = doc.splitTextToSize(`Setting: ${scene.setting}`, contentWidth);
    doc.text(splitSetting, margin, yPos);
    yPos += (splitSetting.length * 5) + 5;

    for (let fIdx = 0; fIdx < scene.frames.length; fIdx++) {
      const frame = scene.frames[fIdx];
      
      if (yPos > 220) {
        doc.addPage();
        yPos = 20;
      }

      doc.setFontSize(12);
      const splitCaption = doc.splitTextToSize(`Frame ${fIdx + 1}: ${frame.caption}`, contentWidth);
      doc.text(splitCaption, margin, yPos);
      yPos += (splitCaption.length * 5) + 2;

      if (frame.imageUrl && frame.status === "completed") {
        try {
          // Process image using the matched aspect ratio to ensure consistency with UI and ZIP
          const { blob: processedBlob, width: actualWidth, height: actualHeight } = await processImage(frame.imageUrl, resolution, aspectRatio, "jpeg");
          const base64Data = await new Promise<string>((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(processedBlob);
          });
          
          // Calculate display dimensions based on actual image ratio
          const imgRatio = actualWidth / actualHeight;
          let imgWidth = contentWidth;
          let imgHeight = imgWidth / imgRatio;
          
          // Cap height to avoid out of bounds (A4 is 297mm high)
          const maxHeight = 120; // Reduced to leave room for metadata
          if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = imgHeight * imgRatio;
          }

          // Center the image horizontally
          const xPos = margin + (contentWidth - imgWidth) / 2;
          
          // Check if image + metadata fits on page
          const metadataHeight = 30; // Estimated height for metadata
          if (yPos + imgHeight + metadataHeight > 280) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.addImage(base64Data, "JPEG", xPos, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 5;

          // Add Metadata (Camera, Lighting, Director's Comments)
          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          
          if (frame.camera || frame.cameraIntent) {
            const cameraText = `CAMERA: ${frame.camera && frame.camera !== "Default" ? frame.camera : frame.cameraIntent}`;
            const splitCamera = doc.splitTextToSize(cameraText, contentWidth);
            doc.text(splitCamera, margin, yPos);
            yPos += (splitCamera.length * 4);
          }
          
          if (frame.lighting || frame.lightingIntent) {
            const lightingText = `LIGHTING: ${frame.lighting && frame.lighting !== "Default" ? frame.lighting : frame.lightingIntent}`;
            const splitLighting = doc.splitTextToSize(lightingText, contentWidth);
            doc.text(splitLighting, margin, yPos);
            yPos += (splitLighting.length * 4);
          }

          if (frame.characterExpression) {
            const expressionText = `EXPRESSION: ${frame.characterExpression}`;
            const splitExpression = doc.splitTextToSize(expressionText, contentWidth);
            doc.text(splitExpression, margin, yPos);
            yPos += (splitExpression.length * 4);
          }

          if (frame.costumeDesign) {
            const costumeText = `COSTUME: ${frame.costumeDesign}`;
            const splitCostume = doc.splitTextToSize(costumeText, contentWidth);
            doc.text(splitCostume, margin, yPos);
            yPos += (splitCostume.length * 4);
          }

          if (frame.cinematographyNotes) {
            doc.setFont("helvetica", "italic");
            const directorText = `DIRECTOR'S NOTES: ${frame.cinematographyNotes}`;
            const splitDirector = doc.splitTextToSize(directorText, contentWidth);
            doc.text(splitDirector, margin, yPos);
            yPos += (splitDirector.length * 4);
            doc.setFont("helvetica", "normal");
          }

          doc.setTextColor(0, 0, 0);
          yPos += 10;
        } catch (error) {
          console.error(`Failed to process frame ${fIdx + 1} for PDF:`, error);
          doc.setFontSize(10);
          doc.text("[Image generation failed or pending]", margin, yPos);
          yPos += 10;
        }
      } else {
        doc.setFontSize(10);
        doc.text("[Image not available]", margin, yPos);
        yPos += 10;
      }
      processedCount++;
      if (onProgress) onProgress((processedCount / totalFrames) * 100);
    }
    yPos += 10;
  }

  return doc.output("blob");
}
