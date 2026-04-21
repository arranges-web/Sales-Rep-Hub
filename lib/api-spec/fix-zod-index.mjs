import { writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexPath = resolve(__dirname, "..", "api-zod", "src", "index.ts");
writeFileSync(indexPath, `export * from "./generated/api";\n`);
console.log("Fixed lib/api-zod/src/index.ts");
