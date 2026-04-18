import fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

const replacements = {
  'bg-slate-950': 'dark:bg-slate-950 bg-slate-50',
  'bg-slate-900/40': 'dark:bg-slate-900/40 bg-white/60',
  'bg-slate-900/50': 'dark:bg-slate-900/50 bg-white/70',
  'bg-slate-900/60': 'dark:bg-slate-900/60 bg-white/80',
  'bg-slate-900/80': 'dark:bg-slate-900/80 bg-white/90',
  'bg-slate-950/50': 'dark:bg-slate-950/50 bg-white/60',
  'bg-slate-950/80': 'dark:bg-slate-950/80 bg-white/90',
  'bg-slate-900': 'dark:bg-slate-900 bg-white',
  'border-white/5': 'dark:border-white/5 border-slate-900/5',
  'border-white/10': 'dark:border-white/10 border-slate-900/10',
  'text-white': 'dark:text-white text-slate-950',
  'text-slate-100': 'dark:text-slate-100 text-slate-900',
  'text-slate-200': 'dark:text-slate-200 text-slate-800',
  'text-slate-300': 'dark:text-slate-300 text-slate-700',
  'text-slate-400': 'dark:text-slate-400 text-slate-600',
  'hover:text-white': 'dark:hover:text-white hover:text-slate-950',
  'hover:bg-slate-800': 'dark:hover:bg-slate-800 hover:bg-slate-100',
  'hover:border-white/20': 'dark:hover:border-white/20 hover:border-slate-900/20',
  'from-white': 'dark:from-white from-slate-800',
  'to-slate-400': 'dark:to-slate-400 to-slate-500',
  'bg-white/10': 'dark:bg-white/10 bg-slate-900/5',
  'bg-white/5': 'dark:bg-white/5 bg-slate-900/5',
  'hover:bg-white/10': 'dark:hover:bg-white/10 hover:bg-slate-900/10',
  'border-zinc-800': 'dark:border-zinc-800 border-zinc-200',
  'border-zinc-700': 'dark:border-zinc-700 border-zinc-300',
  'bg-zinc-900/50': 'dark:bg-zinc-900/50 bg-zinc-100/80',
  'bg-zinc-950': 'dark:bg-zinc-950 bg-zinc-50',
  'bg-zinc-100': 'dark:bg-zinc-100 bg-zinc-900',
  'text-zinc-900': 'dark:text-zinc-900 text-zinc-100',
  'text-zinc-300': 'dark:text-zinc-300 text-zinc-700',
  'text-zinc-400': 'dark:text-zinc-400 text-zinc-600',
  'hover:text-zinc-200': 'dark:hover:text-zinc-200 hover:text-zinc-800',
  'bg-black/60': 'dark:bg-black/60 bg-white/80',
};

for (const [key, val] of Object.entries(replacements)) {
  // Use regex with a preceding space or quote, and succeeding space or quote to replace exactly without replacing twice
  // e.g., (?<=['"\s])bg-slate-950(?=['"\s])
  const regex = new RegExp(`(?<=['"\\s])${key}(?=['"\\s])`, 'g');
  content = content.replace(regex, val);
}

fs.writeFileSync('src/App.tsx', content);
console.log('Done mapping classes!');
