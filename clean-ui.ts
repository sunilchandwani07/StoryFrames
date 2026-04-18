import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// 1. Remove Sun/Moon hook and toggle functionality
content = content.replace(/const \[isDarkMode, setIsDarkMode\] = useState\(true\);\n/g, '');
content = content.replace(/<Button[^>]+setIsDarkMode[^>]+>[\s\S]*?<\/Button>/g, '');
content = content.replace(/\{isDarkMode \? 'dark' : ''\}/g, "''");
content = content.replace(/theme=\{isDarkMode \? "dark" : "light"\}/g, 'theme="light"');

// 2. Remove all `dark:` variants
// `dark:bg-slate-950`, `dark:text-white`, `dark:hover:bg-white/10`
content = content.replace(/\bdark:[a-z0-9/:-]+\b/g, '');

// 3. Remove translucent blurs
content = content.replace(/\bbackdrop-blur-[a-z0-9]+\b/g, '');
content = content.replace(/\bbackdrop-blur\b/g, '');

// 4. Overhaul chaotic backgrounds, texts, borders maps
// We already had sets like "bg-slate-900/40 bg-white/60"
const classMap: Record<string, string> = {
  'bg-slate-50 bg-\\[radial-gradient[^\\]]+\\] from-violet-200/50 via-slate-50 to-slate-50': 'bg-[#f8f9fb]',
  'bg-slate-900/40 bg-white/60': 'bg-white',
  'bg-slate-900/50 bg-white/70': 'bg-white',
  'bg-slate-900/60 bg-white/80': 'bg-white',
  'bg-slate-900/80 bg-white/90': 'bg-white',
  'bg-slate-900/90 bg-white/95': 'bg-white',
  'bg-slate-900/95 bg-white': 'bg-white',
  'bg-slate-950/50 bg-white/60': 'bg-white',
  'bg-slate-950/80 bg-white/90': 'bg-white',
  'bg-slate-900 bg-white': 'bg-white',
  'bg-white/5': '',
  'bg-white/10': '',
  'bg-white/20': '',
  'bg-white/60': 'bg-white',
  'bg-white/70': 'bg-white',
  'bg-white/80': 'bg-white',
  'bg-white/90': 'bg-white',
  'bg-white/95': 'bg-white',
  
  // Grey text boxes specified by user -> fix
  'bg-slate-900/5': 'bg-white',
  'bg-slate-900/10': 'bg-gray-50',
  'bg-slate-50': 'bg-white',
  
  // Shadows (calm down)
  'shadow-\\[0_4px_30px_rgba\\(0,0,0,0\\.1\\)\\]': 'shadow-sm border-b border-gray-200',
  'shadow-2xl': 'shadow-lg',
  'shadow-xl': 'shadow-md',
  'shadow-lg': 'shadow-sm',
  
  // Borders
  'border-white/5 border-slate-900/5': 'border-gray-200',
  'border-white/10 border-slate-900/10': 'border-gray-200',
  'border-white/20 border-slate-900/20': 'border-gray-300',
  'border-slate-900/5': 'border-gray-200',
  'border-slate-900/10': 'border-gray-200',
  'border-slate-900/20': 'border-gray-300',
  'border-white/5': 'border-gray-200',
  'border-white/10': 'border-gray-200',
  'border-white/20': 'border-gray-300',
  'border-slate-800': 'border-gray-200',
  'border-slate-700': 'border-gray-200',
  'border-slate-600 border-slate-300': 'border-gray-300',
  
  // Text colors mapped back to pro light mode
  'text-slate-100 text-slate-800': 'text-gray-900',
  'text-slate-200 text-slate-800': 'text-gray-900',
  'text-slate-300 text-slate-700': 'text-gray-700',
  'text-slate-400 text-slate-600': 'text-gray-500',
  'text-slate-500 text-slate-500': 'text-gray-500',
  'text-slate-100': 'text-gray-900',
  'text-slate-200': 'text-gray-900',
  'text-slate-300': 'text-gray-700',
  'text-slate-400': 'text-gray-500',
  'text-slate-800': 'text-gray-900',
  
  // Hovers
  'hover:bg-slate-800 hover:bg-slate-100': 'hover:bg-gray-100',
  'hover:text-white hover:text-slate-950': 'hover:text-gray-900',
  'hover:text-slate-200 hover:text-slate-800': 'hover:text-gray-900',
  'hover:bg-white/10 hover:bg-slate-900/10': 'hover:bg-gray-100',
  'hover:bg-white/5 hover:bg-slate-900/5': 'hover:bg-gray-50',
  'hover:border-white/20 hover:border-slate-900/20': 'hover:border-gray-300',
  
  // Radius normalization (8px or 12px)
  'rounded-2xl': 'rounded-xl',
  'rounded-3xl': 'rounded-xl',
  'rounded-full': 'rounded-lg',
  
  // Clean background of inputs/textareas
  'bg-slate-950': 'bg-white',
  'bg-black/60 bg-white/80': 'bg-gray-900/80',
  
  // Remove selection noise
  'selection:bg-violet-500/30 selection:text-white': 'selection:bg-blue-100 selection:text-blue-900',
};

for (const [key, val] of Object.entries(classMap)) {
  const regex = new RegExp(key, 'g');
  content = content.replace(regex, val);
}

// Ensure proper background wrappers using Notion standard #f8f9fb or standard bg-gray-50
content = content.replace(/bg-\[#f8f9fb\]/g, 'bg-[#f8f9fb]');
content = content.replace(/bg-slate-950/g, 'bg-white');
content = content.replace(/text-white text-slate-900/g, 'text-gray-900');

fs.writeFileSync('src/App.tsx', content);
console.log('Done mapping classes');
