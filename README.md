# AI Storyboard Generator

An AI-powered storyboard generator that acts as a collaborative film production team to create professional storyboard frames.

## 🎬 Features

- **Storyboard Brain Collaboration**: The AI acts as a team of world-class film professionals (Story Supervisor, Director, Cinematographer, Lighting Director) to design every frame.
- **Character Consistency**: Maintains strict visual consistency of characters (facial anatomy, body structure, attire) across all scenes and frames.
- **Background Consistency**: Locks background architecture, landscape, and object placement within a scene so they don't drift or hallucinate between frames.
- **Professional Cinematography**: Automatically generates and applies Camera Intents, Lighting Intents, and Character Expressions for every shot.
- **Copyright Protection**: Automatically detects requests for copyrighted characters/franchises and adapts them into generic, original equivalents.
- **Export Options**: Download individual frames as PNG/JPEG, download the entire storyboard as a ZIP file, or export it as a formatted PDF document.
- **Custom Aspect Ratios**: Supports standard aspect ratios (16:9, 9:16, 1:1, 4:3, 3:4) and custom ratios (e.g., 21:9) without cropping the final PDF output.
- **High-Resolution Output**: Generate and download frames in Original, 720p, 1080p, or 4K resolutions.

## 🚀 Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn
- A Gemini API Key (from Google AI Studio)

### Installation

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/yourusername/ai-storyboard-generator.git
   cd ai-storyboard-generator
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   npm install
   \`\`\`

3. Set up environment variables:
   Copy the \`.env.example\` file to \`.env\` and add your Gemini API key:
   \`\`\`bash
   cp .env.example .env
   \`\`\`
   Edit \`.env\` and set \`GEMINI_API_KEY=your_api_key_here\`.

### Running the Development Server

Start the Vite development server:

\`\`\`bash
npm run dev
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser to view the application.

## 🛠️ Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4, Framer Motion
- **UI Components**: shadcn/ui, Lucide React
- **AI Integration**: Google Gen AI SDK (\`@google/genai\`) using Gemini 3.1 Pro Preview and Gemini 2.5 Flash models
- **Export Utilities**: jsPDF, JSZip

## 📝 Usage

1. **Enter a Prompt**: Describe your story in the text area. You can include specific character descriptions, camera angles, lighting, and lens attributes.
2. **Upload a Reference Image (Optional)**: Upload an image to use as a strict visual reference for character identity and style.
3. **Configure Settings**: Choose the number of scenes, frames per scene, aspect ratio, and output resolution.
4. **Analyze & Plan**: The AI will analyze your prompt, suggest improvements if necessary, and generate a detailed storyboard plan.
5. **Generate Frames**: Click "Generate Scene" to create the images for each frame based on the AI's detailed prompts.
6. **Regenerate & Tweak**: If a frame isn't perfect, you can regenerate it, optionally overriding the camera or lighting intent.
7. **Export**: Download your finished storyboard as a PDF, ZIP, or individual images.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
