import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// Define paths for the source and destination package.json files
const srcPath = join(import.meta.dirname, "../", "src", "package.json");
const distPath = join(import.meta.dirname, "../", "dist", "package.json");

// Create dist folder if it doesn't exist
if (!existsSync(join(import.meta.dirname, "../", "dist"))) {
  mkdirSync(join(import.meta.dirname, "../", "dist"));
}

// Read the package.json file from src
let packageJson = JSON.parse(readFileSync(srcPath, "utf-8"));

// Update name
packageJson = {
  name: "zksync-account",
  ...packageJson,
};

// Remove unwanted fields
delete packageJson.publishConfig;
delete packageJson.private;

// NOTE: We explicitly don't want to publish the type field.
// We create a separate package.json for `dist/cjs` and `dist/esm` that has the type field.
delete packageJson.type;

// Write the modified package.json to dist
writeFileSync(distPath, JSON.stringify(packageJson, null, 2));

console.log("package.json copied to dist/");
