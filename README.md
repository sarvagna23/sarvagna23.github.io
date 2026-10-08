# Cursor-Tracking Portfolio

Plain HTML, CSS and JS. No build step, no dependencies.

## What is inside

- `index.html` page structure (hero, projects, footer)
- `style.css` layout, custom cursor, card spotlight
- `script.js` cursor, hover ring, spotlight, scrub video
- `assets/scrub.mp4` the hero video (see below)

## Run locally

Video seeking can misbehave when you open the file directly, so use a local server:

```bash
cd portfolio
npx serve            # or: python3 -m http.server 8000
```

## Use your own video

Replace `assets/scrub.mp4` with a clip of 3 to 6 seconds. Every frame must be a keyframe, otherwise scrubbing stutters:

```bash
ffmpeg -i input.mp4 -c:v libx264 -preset slow -crf 18 -g 1 -keyint_min 1 \
  -x264-params "scenecut=0" -profile:v high -pix_fmt yuv420p \
  -movflags +faststart -an assets/scrub.mp4
```

Keep the file under about 20 MB.

## Tweak the feel

All settings are at the top of `script.js`:

| Setting | Effect |
| --- | --- |
| `RING_EASING` | Cursor ring lag (0.15 default, lower is laggier) |
| `AXIS` | `angle` (cursor angle around the face drives a 360 degree eye loop), `horizontal`, or `vertical` |
| `ANGLE_CENTER_X` / `ANGLE_CENTER_Y` | Where the face sits in the hero for angle mode (0.5 and 0.5 is the center) |
| `REVERSE` | Flip the scrub direction |
| `SMOOTHING` | Video inertia (0.22 default, lower is heavier) |
| `TRACK_WINDOW` | `true` = whole page drives the video |
| `TRAIL_RADIUS` | Size of the orange trail blobs in the projects zone |
| `TRAIL_LIFETIME` | How long the orange trail takes to fade, in ms |

The projects, LinkedIn and GitHub area uses `assets/gingham-pink.jpg` as its background and `assets/gingham-orange.jpg` as the layer revealed by the cursor trail.

## Deploy free

Push the folder to GitHub, then enable GitHub Pages (Settings, then Pages), or import the repo on Vercel or Netlify.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Choppy scrub | Re-encode with `-g 1 -keyint_min 1` |
| Stuck on frame 0 | Use a local server, not `file://` |
| Jumpy on fast moves | Lower `SMOOTHING` to 0.10 to 0.15 |
| Nothing on iPhone | Keep `muted` and `playsinline` on the video |
