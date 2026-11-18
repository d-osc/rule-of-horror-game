# Asset provenance

The bathroom props and apparition were authored locally in Blender with reproducible scripts under `scripts/blender/`. The student apparition is stylized procedural modeling, not a photographic scan or a Tripo-generated character. The older ghost model is retained as source history; runtime loads `ghost-aaa.glb`.

The runtime PBR materials use Poly Haven assets under [CC0](https://polyhaven.com/license):

- [Interior Tiles](https://polyhaven.com/a/interior_tiles): floor diffuse, OpenGL normal, roughness and AO, 1K.
- [Long White Tiles](https://polyhaven.com/a/long_white_tiles): tinted glazed wall tiles, same four channels, 1K.
- [Worn Plaster Wall](https://polyhaven.com/a/worn_plaster_wall): upper walls, same four channels, 1K.

Exact download URLs are recorded in `public/textures/sources.json`. Re-fetch with `scripts/fetch-materials.ps1`. Runtime textures are bundled locally; there are no live Poly Haven requests during play. The twelve JPG maps total 6,230,858 bytes.

IBM Plex Sans Thai and Libre Caslon Display are bundled through their `@fontsource` packages. Their package licenses remain in the installed packages. No external font CDN is used.

Story source and adaptation notes are in `references/episode-01-source.md`. No source video, narration or music is bundled. Game ambience and effects are synthesized locally with Web Audio.

Episode 1 character dialogue uses newly authored Thai lines in `src/game/episode01-dialogue.json`.
The eight bundled MP3 files in `public/audio/episode-01/` were synthesized with
Microsoft Edge TTS (th-TH-NiwatNeural for the guest and check-in clerk) and Google
Translate TTS (Thai voice for the apparition and check-out clerk). Apparition
lines receive slowed playback, stereo placement and room reverberation in game.
These are synthetic character voices. No narrator recording from the source video is included.
