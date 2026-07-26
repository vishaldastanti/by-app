const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'controllers', 'admin.controller.ts');
let content = fs.readFileSync(filePath, 'utf8');

// Replace import
content = content.replace(
  /import { supabase } from '\.\.\/config\/supabase';/g,
  "import { getSupabaseClient, adminSupabase } from '../config/supabase';"
);

// Inject supabase client in route handlers
// Use adminSupabase for all admin controller methods to ensure they bypass RLS restrictions safely since admins must access all rows
const handlerRegex = /(export const \w+\s*=\s*async\s*\(\s*req:\s*Request,\s*res:\s*Response\s*\)\s*=>\s*\{)/g;

content = content.replace(handlerRegex, "$1\n  const supabase = adminSupabase;");

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Refactored admin.controller.ts`);
