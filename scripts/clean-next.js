const fs = require("fs");
const path = require("path");

const nextDir = path.join(process.cwd(), ".next");

try {
  fs.rmSync(nextDir, { recursive: true, force: true });
  process.stdout.write("Cleaned .next cache\n");
} catch (error) {
  process.stderr.write(`Failed to clean .next cache: ${error.message}\n`);
  process.exitCode = 1;
}
