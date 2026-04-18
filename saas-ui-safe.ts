import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Strip out lingering "dark:" and empty space
content = content.replace(/className=\s*" /g, 'className="');
content = content.replace(/ "\s*>/g, '">');

// Strip gradients from buttons
content = content.replace(/bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-500 hover:to-fuchsia-500/g, 'bg-violet-600 hover:bg-violet-700 hover:scale-100');
content = content.replace(/bg-gradient-to-r from-violet-600 to-blue-600/g, 'bg-violet-600 hover:bg-violet-700');
content = content.replace(/bg-gradient-to-br from-slate-800 to-violet-300/g, 'bg-clip-text text-transparent bg-gradient-to-r from-violet-600 to-fuchsia-600');
content = content.replace(/bg-gradient-to-r from-slate-800 to-slate-500/g, 'bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700');
content = content.replace(/bg-gradient-to-br from-slate-800 via-slate-200 to-slate-500/g, 'bg-clip-text text-transparent bg-gradient-to-r from-slate-900 to-slate-700');

// Fix buttons text colors for contrast against solid bg
content = content.replace(/text-slate-900 shadow-md shadow-violet-900\/30/g, 'text-white shadow-sm shadow-violet-600/20');

// Fix Textarea and inputs looking weird (e.g., bg-white/50)
content = content.replace(/bg-white\/50/g, 'bg-white');
content = content.replace(/bg-slate-50\/40/g, 'bg-white');
content = content.replace(/bg-slate-50\/60/g, 'bg-white');
content = content.replace(/bg-slate-50\/80/g, 'bg-white');
content = content.replace(/bg-slate-50\/95/g, 'bg-white');

// Fix overly rounded corners and strange border radius
content = content.replace(/rounded-\[2\.5rem\]/g, 'rounded-2xl');
content = content.replace(/rounded-\[2rem\]/g, 'rounded-2xl');
content = content.replace(/rounded-\[1\.5rem\]/g, 'rounded-xl');
content = content.replace(/rounded-\[1\.6rem\]/g, 'rounded-xl');

// Clean up weird text styling on drop downs
content = content.replace(/focus: focus:text-white/g, 'focus:bg-slate-100 focus:text-slate-900');
content = content.replace(/focus: /g, 'focus:bg-slate-100 ');

// Fix specific hover glitches without breaking spaces
content = content.replace(/hover: hover:text-slate-950/g, 'hover:bg-slate-100 hover:text-slate-900');

fs.writeFileSync('src/App.tsx', content);
console.log('Safer SaaS cleanup done!');
