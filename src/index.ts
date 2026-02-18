#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";
import * as fs from "node:fs";
import * as path from "node:path";

const MODELS: Record<string, string> = {
  flash: "gemini-2.5-flash-image",
  pro: "gemini-3-pro-image-preview",
};

const IMAGE_SIZES: Record<string, { width: number; height: number }> = {
  "1K": { width: 1024, height: 1024 },
  "2K": { width: 2048, height: 2048 },
  "4K": { width: 4096, height: 4096 },
};

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
  console.error(
    "Error: GEMINI_API_KEY environment variable is required.\n" +
      "Get your key at https://aistudio.google.com/apikey"
  );
  process.exit(1);
}

const ai = new GoogleGenAI({ apiKey });

const server = new McpServer({
  name: "image-generator-vibe-coding",
  version: "1.0.0",
});

function ensureDir(dir: string): string {
  const resolved = path.resolve(dir);
  if (!fs.existsSync(resolved)) {
    fs.mkdirSync(resolved, { recursive: true });
  }
  return resolved;
}

function saveImage(
  base64Data: string,
  outputDir: string,
  index: number
): string {
  const dir = ensureDir(outputDir);
  const timestamp = Date.now();
  const filename = `image-${timestamp}-${index}.png`;
  const filepath = path.join(dir, filename);
  fs.writeFileSync(filepath, Buffer.from(base64Data, "base64"));
  return filepath;
}

server.tool(
  "generate_image",
  "Generate an image from a text prompt using Google Gemini (Nano Banana / Nano Banana Pro)",
  {
    prompt: z.string().describe("Text description of the image to generate"),
    model: z
      .enum(["flash", "pro"])
      .default("flash")
      .describe(
        'Model to use: "flash" (fast, high-volume) or "pro" (high quality)'
      ),
    aspectRatio: z
      .enum(["1:1", "16:9", "9:16", "3:4", "4:3"])
      .default("1:1")
      .describe("Aspect ratio of the generated image"),
    imageSize: z
      .enum(["1K", "2K", "4K"])
      .default("1K")
      .describe("Resolution of the generated image"),
    outputDir: z
      .string()
      .default("./generated-images")
      .describe("Directory to save generated images"),
  },
  async ({ prompt, model, aspectRatio, imageSize, outputDir }) => {
    try {
      const modelId = MODELS[model];
      const size = IMAGE_SIZES[imageSize];

      const response = await ai.models.generateContent({
        model: modelId,
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          ...(aspectRatio !== "1:1" && {
            generationConfig: {
              aspectRatio,
            },
          }),
        },
      });

      const result: Array<{
        type: "text" | "image";
        text?: string;
        data?: string;
        mimeType?: string;
      }> = [];
      const savedPaths: string[] = [];
      let imageIndex = 0;

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            result.push({ type: "text", text: part.text });
          }
          if (part.inlineData) {
            const base64 = part.inlineData.data;
            const mimeType = part.inlineData.mimeType || "image/png";
            if (base64) {
              const filepath = saveImage(base64, outputDir, imageIndex++);
              savedPaths.push(filepath);
              result.push({
                type: "image",
                data: base64,
                mimeType,
              });
            }
          }
        }
      }

      if (result.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No image was generated. The model may not have produced an image for this prompt. Try rephrasing your prompt.",
            },
          ],
        };
      }

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [];

      const textParts = result.filter((r) => r.type === "text");
      const imageParts = result.filter((r) => r.type === "image");

      const summary = [
        `Generated ${imageParts.length} image(s) using ${model === "pro" ? "Nano Banana Pro" : "Nano Banana"} (${modelId})`,
        `Aspect ratio: ${aspectRatio} | Size: ${imageSize} (${size.width}x${size.height})`,
        ...savedPaths.map((p) => `Saved: ${p}`),
        ...(textParts.length > 0
          ? [`\nModel response: ${textParts.map((t) => t.text).join("\n")}`]
          : []),
      ].join("\n");

      content.push({ type: "text" as const, text: summary });

      for (const img of imageParts) {
        if (img.data && img.mimeType) {
          content.push({
            type: "image" as const,
            data: img.data,
            mimeType: img.mimeType,
          });
        }
      }

      return { content };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error generating image: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

server.tool(
  "edit_image",
  "Edit an existing image with text instructions using Google Gemini",
  {
    prompt: z
      .string()
      .describe("Text instructions for how to edit the image"),
    imagePath: z.string().describe("Path to the source image to edit"),
    model: z
      .enum(["flash", "pro"])
      .default("flash")
      .describe(
        'Model to use: "flash" (fast) or "pro" (high quality)'
      ),
    aspectRatio: z
      .enum(["1:1", "16:9", "9:16", "3:4", "4:3"])
      .optional()
      .describe("Aspect ratio for the output image"),
    outputDir: z
      .string()
      .default("./generated-images")
      .describe("Directory to save edited images"),
  },
  async ({ prompt, imagePath, model, aspectRatio, outputDir }) => {
    try {
      const resolvedPath = path.resolve(imagePath);
      if (!fs.existsSync(resolvedPath)) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error: Image file not found at ${resolvedPath}`,
            },
          ],
          isError: true,
        };
      }

      const imageBuffer = fs.readFileSync(resolvedPath);
      const base64Image = imageBuffer.toString("base64");
      const ext = path.extname(resolvedPath).toLowerCase();
      const mimeTypeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
      };
      const imageMimeType = mimeTypeMap[ext] || "image/png";

      const modelId = MODELS[model];

      const response = await ai.models.generateContent({
        model: modelId,
        contents: [
          {
            role: "user",
            parts: [
              {
                inlineData: {
                  data: base64Image,
                  mimeType: imageMimeType,
                },
              },
              { text: prompt },
            ],
          },
        ],
        config: {
          responseModalities: ["TEXT", "IMAGE"],
          ...(aspectRatio && {
            generationConfig: {
              aspectRatio,
            },
          }),
        },
      });

      const content: Array<
        | { type: "text"; text: string }
        | { type: "image"; data: string; mimeType: string }
      > = [];
      const savedPaths: string[] = [];
      let imageIndex = 0;
      const textParts: string[] = [];

      if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
          if (part.text) {
            textParts.push(part.text);
          }
          if (part.inlineData) {
            const base64 = part.inlineData.data;
            const mime = part.inlineData.mimeType || "image/png";
            if (base64) {
              const filepath = saveImage(base64, outputDir, imageIndex++);
              savedPaths.push(filepath);
              content.push({
                type: "image" as const,
                data: base64,
                mimeType: mime,
              });
            }
          }
        }
      }

      if (savedPaths.length === 0) {
        return {
          content: [
            {
              type: "text" as const,
              text: "No edited image was generated. The model may not have been able to edit the image with the given instructions. Try different instructions.",
            },
          ],
        };
      }

      const summary = [
        `Edited image using ${model === "pro" ? "Nano Banana Pro" : "Nano Banana"} (${modelId})`,
        `Source: ${resolvedPath}`,
        ...savedPaths.map((p) => `Saved: ${p}`),
        ...(textParts.length > 0
          ? [`\nModel response: ${textParts.join("\n")}`]
          : []),
      ].join("\n");

      content.unshift({ type: "text" as const, text: summary });

      return { content };
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : "Unknown error occurred";
      return {
        content: [
          {
            type: "text" as const,
            text: `Error editing image: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }
);

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Image Generator MCP server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
