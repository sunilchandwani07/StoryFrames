import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Fix text colors for light theme (high contrast)
content = content.replace(/from-violet-300 to-fuchsia-300/g, 'from-violet-600 to-fuchsia-600');
content = content.replace(/from-fuchsia-300 to-rose-300/g, 'from-fuchsia-600 to-rose-600');
content = content.replace(/text-violet-300\/80/g, 'text-violet-600');
content = content.replace(/text-fuchsia-300\/80/g, 'text-fuchsia-600');
content = content.replace(/text-amber-200\/90/g, 'text-amber-800');
content = content.replace(/text-amber-200/g, 'text-amber-800');
content = content.replace(/text-violet-300/g, 'text-violet-600');
content = content.replace(/text-fuchsia-300/g, 'text-fuchsia-600');
content = content.replace(/text-rose-300/g, 'text-rose-600');
content = content.replace(/text-emerald-400/g, 'text-emerald-700');
content = content.replace(/bg-emerald-500\/10/g, 'bg-emerald-50');
content = content.replace(/border-emerald-500\/20/g, 'border-emerald-200');

// Fix the loader components background and animation colors
content = content.replace(/bg-slate-50\/60/g, 'bg-white');
content = content.replace(/bg-fuchsia-400/g, 'bg-fuchsia-600');
content = content.replace(/text-fuchsia-400/g, 'text-fuchsia-600');
content = content.replace(/text-amber-400/g, 'text-amber-600');

fs.writeFileSync('src/App.tsx', content);
console.log('High contrast text applied!');
