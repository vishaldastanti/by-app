const fs = require('fs');
const path = require('path');

const controllersDir = path.join(__dirname, 'src', 'controllers');

const files = fs.readdirSync(controllersDir).filter(f => f.endsWith('.ts'));

for (const file of files) {
  const filePath = path.join(controllersDir, file);
  let content = fs.readFileSync(filePath, 'utf8');

  // Skip auth.controller.ts because it needs custom adminSupabase handling
  if (file === 'auth.controller.ts') continue;

  // 1. Replace import
  content = content.replace(
    /import { supabase } from '\.\.\/config\/supabase';/g,
    "import { getSupabaseClient, adminSupabase } from '../config/supabase';"
  );

  // 2. Inject supabase client in route handlers
  // Match: export const getProfile = async (req: Request, res: Response) => {
  const handlerRegex = /(export const \w+\s*=\s*async\s*\(\s*req:\s*Request,\s*res:\s*Response\s*\)\s*=>\s*\{)(?!\s*const supabase = getSupabaseClient\(req\);)/g;
  
  content = content.replace(handlerRegex, "$1\n  const supabase = getSupabaseClient(req);");

  // Write back
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Refactored ${file}`);
}
