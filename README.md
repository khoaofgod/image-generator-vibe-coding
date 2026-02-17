# Image Generator MCP Server

An MCP (Model Context Protocol) server for AI image generation using Google Gemini. Works with **Claude Code**, **Cursor**, **Windsurf**, and any MCP-compatible tool.

## Models

| Name | Model | Best For |
|---|---|---|
| Nano Banana (flash) | `gemini-2.5-flash-preview-image-generation` | Fast, high-volume generation |
| Nano Banana Pro | `gemini-2.0-flash-exp` | High quality output |

## Setup

### 1. Get a Gemini API Key

Get your free API key at [Google AI Studio](https://aistudio.google.com/apikey).

### 2. Add to your MCP client

#### Claude Code

```bash
claude mcp add image-generator -- npx -y @khoaofgod/image-generator-vibe-coding
```

Then set your API key in the MCP config, or export it:

```bash
export GEMINI_API_KEY=your-key-here
```

#### Manual config (Claude Code, Cursor, Windsurf, etc.)

Add to your MCP settings:

```json
{
  "mcpServers": {
    "image-generator": {
      "command": "npx",
      "args": ["-y", "@khoaofgod/image-generator-vibe-coding"],
      "env": {
        "GEMINI_API_KEY": "your-api-key-here"
      }
    }
  }
}
```

## Tools

### `generate_image`

Generate an image from a text prompt.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `prompt` | string | (required) | Text description of the image |
| `model` | `"flash"` \| `"pro"` | `"flash"` | Which model to use |
| `aspectRatio` | `"1:1"` \| `"16:9"` \| `"9:16"` \| `"3:4"` \| `"4:3"` | `"1:1"` | Aspect ratio |
| `imageSize` | `"1K"` \| `"2K"` \| `"4K"` | `"1K"` | Resolution |
| `outputDir` | string | `"./generated-images"` | Save directory |

### `edit_image`

Edit an existing image with text instructions.

| Parameter | Type | Default | Description |
|---|---|---|---|
| `prompt` | string | (required) | Edit instructions |
| `imagePath` | string | (required) | Path to source image |
| `model` | `"flash"` \| `"pro"` | `"flash"` | Which model to use |
| `aspectRatio` | `"1:1"` \| `"16:9"` \| `"9:16"` \| `"3:4"` \| `"4:3"` | (optional) | Output aspect ratio |
| `outputDir` | string | `"./generated-images"` | Save directory |

## Examples

Once configured, ask your AI assistant:

- "Generate an image of a sunset over mountains"
- "Create a logo for a coffee shop called Bean There"
- "Edit this image to make the sky more dramatic"
- "Generate a 16:9 banner image for my blog post about AI"

## Development

```bash
git clone https://github.com/khoaofgod/image-generator-vibe-coding.git
cd image-generator-vibe-coding
npm install
npm run build
```

Test locally:

```bash
GEMINI_API_KEY=your-key node dist/index.js
```

## License

MIT
