import sharp from "sharp";
import fs from "fs";
import path from "path";

const srcFile = path.join(process.cwd(), "public/logo.png");
const destDir = path.join(process.cwd(), "public");

const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "android-chrome-192x192.png", size: 192 },
  { name: "android-chrome-512x512.png", size: 512 }
];

async function generate() {
  try {
    for (const item of sizes) {
      await sharp(srcFile)
        .resize(item.size, item.size, {
          fit: 'contain',
          background: { r: 255, g: 255, b: 255, alpha: 0 }
        })
        .toFile(path.join(destDir, item.name));
      console.log(`Generated ${item.name}`);
    }

    // Generate favicon.ico (just copy 32x32 for simplicity or convert, but standard web supports png favicon)
    await sharp(srcFile)
      .resize(32, 32)
      .toFile(path.join(destDir, "favicon.png")); // Replace standard favicon.png
    console.log("Generated favicon.png");

    // Open Graph image (1200x630)
    await sharp(srcFile)
      .resize(1200, 630, {
        fit: 'contain',
        background: { r: 255, g: 255, b: 255, alpha: 1 }
      })
      .toFile(path.join(destDir, "og-image.jpg"));
    console.log("Generated og-image.jpg");

  } catch (err) {
    console.error("Error generating icons:", err);
  }
}

generate();
