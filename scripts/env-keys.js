const fs = require("fs");

const lines = fs
  .readFileSync(".env.local", "utf8")
  .split(/\r?\n/)
  .filter(Boolean)
  .filter((line) => !line.trim().startsWith("#"));

for (const line of lines) {
  const idx = line.indexOf("=");
  if (idx > 0) {
    console.log(line.slice(0, idx));
  }
}
