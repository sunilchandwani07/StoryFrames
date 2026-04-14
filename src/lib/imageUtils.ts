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

export async function exportToPDF(storyboard: any, resolution: "original" | "720p" | "1080p" | "4k", aspectRatio: string): Promise<Blob> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4"
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  
  doc.setFontSize(20);
  doc.text(storyboard.title || "Storyboard", margin, 20);
  
  doc.setFontSize(12);
  const splitSummary = doc.splitTextToSize(storyboard.storySummary || "", contentWidth);
  doc.text(splitSummary, margin, 30);
  
  let yPos = 30 + (splitSummary.length * 6) + 10;

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
          // Process image - use "original" to avoid cropping in PDF
          const { blob: processedBlob, width: actualWidth, height: actualHeight } = await processImage(frame.imageUrl, resolution, "original", "jpeg");
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
          const maxHeight = 180; // Leave room for caption and margins
          if (imgHeight > maxHeight) {
            imgHeight = maxHeight;
            imgWidth = imgHeight * imgRatio;
          }

          // Center the image horizontally
          const xPos = margin + (contentWidth - imgWidth) / 2;
          
          // Check if image fits on page, if not add new page
          if (yPos + imgHeight > 280) {
            doc.addPage();
            yPos = 20;
          }
          
          doc.addImage(base64Data, "JPEG", xPos, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 10;
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
    }
    yPos += 10;
  }

  return doc.output("blob");
}
