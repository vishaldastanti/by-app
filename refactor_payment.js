const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src', 'controllers', 'payment.controller.ts');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Replace import
content = content.replace(
  /import { supabase } from '\.\.\/config\/supabase';/g,
  "import { getSupabaseClient, adminSupabase } from '../config/supabase';"
);

// 2. Inject getSupabaseClient into createOrder and verifyPayment
const handlerRegex = /(export const (createOrder|verifyPayment)\s*=\s*async\s*\(\s*req:\s*Request,\s*res:\s*Response\s*\)\s*=>\s*\{)/g;
content = content.replace(handlerRegex, "$1\n  const supabase = getSupabaseClient(req);");

// 3. Inject adminSupabase into webhook
const webhookRegex = /(export const webhook\s*=\s*async\s*\(\s*req:\s*Request,\s*res:\s*Response\s*\)\s*=>\s*\{)/g;
content = content.replace(webhookRegex, "$1\n  const supabase = adminSupabase;");

fs.writeFileSync(filePath, content, 'utf8');
console.log(`Refactored payment.controller.ts cleanly.`);
