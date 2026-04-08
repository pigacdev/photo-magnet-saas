## Development Workflow

- Always work in phases from implementation-plan.md
- Never skip ahead

### Before coding:
- Explain approach
- Confirm understanding

### During coding:
- Implement only requested scope
- Do not add extra features

### After coding:
- Explain what was built
- Highlight any assumptions

### Critical areas:
- Cropping
- Image processing
- PDF generation

→ Must be double-checked before implementation

### Session image URLs & canvas (review / crop previews)

Review uses a **canvas** to draw the stored crop (`CroppedShapePreview`). Behavior by URL type:

| URL | `crossOrigin` | Requirement |
|-----|---------------|-------------|
| Same-origin path (e.g. local `/uploads/...`) | not set | Works without extra headers. |
| Absolute `https://` (e.g. public S3 object URL) | `anonymous` | Storage must respond with **CORS** so the image is a CORS-enabled resource: include `Access-Control-Allow-Origin` for your app origin (or `*` for public reads). If missing, the image load can fail or the canvas stays security-tainted. |

Configure the bucket / CDN **before** relying on remote session image URLs in production.