# Fretlab

Fretlab is a guitar and bass fretboard visualizer. It shows keys, diatonic degrees and modes, pentatonic boxes, triads, seventh arpeggios, chord grips, a progression builder, and Solopath (staircase solo regions across a progression).

The app is a static site built with Vite, React 19, TypeScript, and Tailwind CSS v4.

## Run locally

```bash
npm ci
npm run dev
```

Vite serves the app at http://localhost:5173.

```bash
npm run build    # writes dist/
npm run preview  # serves the production build
```

## Deploy

Pushes to `main`, and manual runs from the Actions tab, build the site and deploy `dist/` to GitHub Pages. The live site is https://songsponge.com.
