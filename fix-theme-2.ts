import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = {
  // We missed some instances. Regex without assertions:
  // Since we already did some replacements, we must not replace them again.
  // E.g., we don't want to replace "dark:bg-slate-950" to "dark:dark:bg-slate-950".
  'bg-slate-950': 'dark:bg-slate-950 bg-slate-50',
  'bg-slate-900/40': 'dark:bg-slate-900/40 bg-white/60',
  'bg-slate-900/50': 'dark:bg-slate-900/50 bg-white/70',
  'bg-slate-900/60': 'dark:bg-slate-900/60 bg-white/80',
  'bg-slate-900/80': 'dark:bg-slate-900/80 bg-white/90',
  'bg-slate-900/90': 'dark:bg-slate-900/90 bg-white/95',
  'bg-slate-900/95': 'dark:bg-slate-900/95 bg-white',
  'bg-slate-950/50': 'dark:bg-slate-950/50 bg-white/60',
  'bg-slate-950/80': 'dark:bg-slate-950/80 bg-white/90',
  'bg-slate-900': 'dark:bg-slate-900 bg-white',
  
  // text
  'text-white': 'dark:text-white text-slate-900',
  'text-slate-100': 'dark:text-slate-100 text-slate-800',
  'text-slate-200': 'dark:text-slate-200 text-slate-800',
  'text-slate-300': 'dark:text-slate-300 text-slate-700',
  'text-slate-400': 'dark:text-slate-400 text-slate-600',
  'text-slate-500': 'dark:text-slate-500 text-slate-500',
  'border-slate-600': 'dark:border-slate-600 border-slate-300',
  
  // hover text
  'hover:text-white': 'dark:hover:text-white hover:text-slate-950',
  'hover:bg-slate-800': 'dark:hover:bg-slate-800 hover:bg-slate-100',
  
  // borders
  'border-white/5': 'dark:border-white/5 border-slate-900/5',
  'border-white/10': 'dark:border-white/10 border-slate-900/10',
  'border-white/20': 'dark:border-white/20 border-slate-900/20',
  'hover:border-white/20': 'dark:hover:border-white/20 hover:border-slate-900/20',
  
  // special background
  'from-white': 'dark:from-white from-slate-800',
  'to-slate-400': 'dark:to-slate-400 to-slate-500',
  'bg-white/10': 'dark:bg-white/10 bg-slate-900/5',
  'bg-white/5': 'dark:bg-white/5 bg-slate-900/5',
  'hover:bg-white/10': 'dark:hover:bg-white/10 hover:bg-slate-900/10',
  'hover:bg-white/5': 'dark:hover:bg-white/5 hover:bg-slate-900/5',
  'bg-black/60': 'dark:bg-black/60 bg-white/80',
  
  // fallbacks
  'border-zinc-800': 'dark:border-zinc-800 border-zinc-200',
  'border-zinc-700': 'dark:border-zinc-700 border-zinc-300',
  'bg-zinc-900/50': 'dark:bg-zinc-900/50 bg-zinc-100/80',
  'bg-zinc-950': 'dark:bg-zinc-950 bg-zinc-50',
  'bg-zinc-100': 'dark:bg-zinc-100 bg-zinc-900',
  'bg-zinc-800': 'dark:bg-zinc-800 bg-zinc-200',
  'text-zinc-900': 'dark:text-zinc-900 text-zinc-100',
  'text-zinc-300': 'dark:text-zinc-300 text-zinc-700',
  'text-zinc-400': 'dark:text-zinc-400 text-zinc-600',
  'hover:text-zinc-200': 'dark:hover:text-zinc-200 hover:text-zinc-800',
  
  // Remaining gradients
  'via-slate-950': 'dark:via-slate-950 via-slate-50',
  'to-slate-950': 'dark:to-slate-950 to-slate-50',
  'from-violet-900/20': 'dark:from-violet-900/20 from-violet-200/50',
};

// Undo previous attempt first so things are clean
for (const [key, val] of Object.entries(replacements)) {
  content = content.replace(new RegExp(val.replace(/[/]/g, '\\\\/'), 'g'), key);
}
// Now apply with flexible regex that checks for word boundaries but allows `/` inside the token
for (const [key, val] of Object.entries(replacements)) {
  // Check if string is enclosed by standard classname separators ` `"'\`
  // Actually, we can just split by space, map, and join. But we have quotes!
  // It's safer to use regex that does not match if preceded by `:` to avoid `hover:bg...` double
  const regex = new RegExp(`(?<![:])\\b${key.replace(/[/]/g, '\\\\/')}\\b(?!/)`, 'g');
  console.log('Replacing', key, 'with', val);
  content = content.replace(regex, val);
}

fs.writeFileSync('src/App.tsx', content);
console.log('Done mapping classes precisely!');
