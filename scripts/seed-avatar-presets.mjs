import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const scriptDirectory = dirname(fileURLToPath(import.meta.url));
const projectDirectory = resolve(scriptDirectory, "..");
const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.");
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const presets = [
  "ocean-explorer.webp",
  "coral-guardian.webp",
  "fisheries-professional.webp",
  "marine-researcher.webp",
];

for (const fileName of presets) {
  const contents = await readFile(resolve(projectDirectory, "src/assets/avatar-presets", fileName));
  const { error } = await supabase.storage.from("avatars").upload(`presets/${fileName}`, contents, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) throw new Error(`Unable to seed ${fileName}: ${error.message}`);
  console.log(`Seeded presets/${fileName}`);
}
