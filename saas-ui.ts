import * as fs from 'fs';

let content = fs.readFileSync('src/App.tsx', 'utf8');

// Strip out lingering "dark:" and empty space
content = content.replace(/\s{2,}/g, ' '); 
content = content.replace(/className=\s*" /g, 'className="');
content = content.replace(/ "\s*>/g, '">');

// Standardize Input Textareas and Selects to avoid grey backgrounds!
// Currently we have bg-slate-900/80 bg-white/90 -> bg-white
// We want standard borders.
const inputPattern = /bg-slate-[0-9]+\/?[0-9]*|bg-white\/?[0-9]*/g;
// Actually, it's safer to just replace standard classes for those elements.
content = content.replace(/bg-gray-800/g, 'bg-white');
content = content.replace(/bg-slate-800/g, 'bg-slate-50');
content = content.replace(/focus:ring-violet-[0-9]+\/?[0-9]*/g, 'focus:ring-violet-500');

// Fix buttons that have "bg-gradient-to-r..." 
content = content.replace(/bg-gradient-to-r from-violet-600 to-blue-600/g, 'bg-violet-600 hover:bg-violet-700');
content = content.replace(/bg-gradient-to-r from-violet-500 to-fuchsia-500/g, 'bg-violet-600 hover:bg-violet-700');
content = content.replace(/bg-gradient-to-r from-violet-500 to-fuchsia-600/g, 'bg-violet-600 hover:bg-violet-700');
content = content.replace(/text-transparent bg-clip-text/g, 'text-slate-900');

// Fix text colors
content = content.replace(/text-gray-900/g, 'text-slate-900');
content = content.replace(/text-gray-700/g, 'text-slate-600');
content = content.replace(/text-slate-300/g, 'text-slate-600');
content = content.replace(/text-slate-400/g, 'text-slate-500');
content = content.replace(/text-white hover:text-slate-950/g, 'text-white hover:text-white'); // ensure primary buttons stay readable
content = content.replace(/text-slate-900 hover:text-slate-950/g, 'text-white hover:text-white'); // Fix any corrupted primary buttons

// Overhaul Card UI to be distinct Stripe/Vercel SaaS
content = content.replace(/border-gray-200/g, 'border-slate-200');
content = content.replace(/shadow-sm border-b border-slate-200/g, 'shadow-sm border-b border-slate-200');

// Re-write hover states for standard interactive elements
content = content.replace(/hover:bg-gray-100/g, 'hover:bg-slate-50');
content = content.replace(/hover:bg-gray-50/g, 'hover:bg-slate-50');

// Remove floating hover:
content = content.replace(/\bhover:\b(?![\w-])/g, ''); 

// Ensure Inputs conform
content = content.replace(/bg-slate-950/g, 'bg-white'); // For custom inputs that might have gotten missed
content = content.replace(/border-white\/10/g, 'border-slate-200');
content = content.replace(/border-white\/20/g, 'border-slate-300');

// Fix drop down menus
content = content.replace(/bg-slate-900\/90/g, 'bg-white');

// More floating classes
content = content.replace(/bg-slate-900/g, 'bg-slate-50');

fs.writeFileSync('src/App.tsx', content);
console.log('Final SaaS cleanup done!');
