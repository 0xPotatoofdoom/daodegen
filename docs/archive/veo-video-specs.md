# Dao DeGen — Short-Form Video Specs (Google Veo)

## Format
- **Duration:** 15-30 seconds (YouTube Shorts / TikTok / Reels)
- **Aspect Ratio:** 9:16 (1080×1920)
- **Style:** Cinematic, dark palette (dao-purple #2D1B69 / dao-gold #D4AF37), ethereal
- **Audio:** ElevenLabs TTS narration over ambient music

## Video Structure (per verse)

```
[0-3s]  Title card: "Verse {N}" with gold text on dark bg, particle effects
[3-20s] Visual sequence matching verse theme (Veo-generated)
[20-25s] Key quote overlay (gold on dark, serif font)
[25-30s] End card: "Dao DeGen" logo + "x·y=k doesn't care" + link
```

## Veo Prompt Template

```
Cinematic slow-motion, dark purple atmospheric lighting, 
gold particle effects, {VERSE_VISUAL_DESCRIPTION}, 
ethereal and philosophical mood, 4K quality, 
dark palette with gold accents, no text overlays
```

## Example Prompts (First 5 Verses)

### Verse 1 — "The Eternal Protocol"
```
Cinematic slow-motion, dark purple atmospheric lighting,
a glowing blockchain network emerging from primordial void,
golden data streams flowing through ethereal space,
code materializing and dissolving like ancient scripture,
philosophical mood, 4K quality, dark palette with gold accents
```

### Verse 2 — "The Dance of Opposites"  
```
Cinematic slow-motion, dark purple atmospheric lighting,
yin-yang symbol made of flowing golden liquidity pools,
buy and sell orders dancing in perfect balance,
two opposing forces creating harmony in dark space,
ethereal and philosophical mood, 4K quality
```

### Verse 3 — "Governing Without Force"
```
Cinematic slow-motion, dark purple atmospheric lighting,
a decentralized network of golden nodes self-organizing,
no central authority visible, emergent order from chaos,
governance tokens floating and aligning naturally,
philosophical mood, 4K quality, dark palette with gold accents
```

### Verse 4 — "The Inexhaustible Pool"
```
Cinematic slow-motion, dark purple atmospheric lighting,
infinite golden liquidity pool stretching into cosmic void,
tokens flowing endlessly through a bottomless vessel,
abundance without depletion, recursive and fractal,
ethereal mood, 4K quality, dark palette with gold accents
```

### Verse 5 — "The Impartial Protocol"
```
Cinematic slow-motion, dark purple atmospheric lighting,
a vast automated market maker treating all traders equally,
golden scales of perfect balance, no favoritism,
anonymous wallets interacting with pure mathematical fairness,
philosophical mood, 4K quality, dark palette with gold accents
```

## Production Pipeline (for GPU Desktop)

1. **Script:** Leo generates verse-specific Veo prompts (this doc)
2. **Video Gen:** GPU Desktop runs Veo API → raw 15s clips
3. **Audio:** ElevenLabs TTS reads key verse quote (5-10s)
4. **Assembly:** FFmpeg composites: title card + Veo clip + quote overlay + end card
5. **Music:** Ambient background track (royalty-free or AI-generated)
6. **Export:** 1080×1920 MP4, <60s, optimized for social upload
7. **Schedule:** SurfaceClaw posts per campaign calendar

## Batch Processing

Generate all 81 videos in one batch:
- Veo clips: ~$0.05-0.10 each → ~$4-8 total
- TTS: already covered by ElevenLabs plan
- Assembly: automated FFmpeg script
- Total time: ~2-3 hours with GPU Desktop

## Notes
- Veo 2 supports 8s clips; may need to chain 2-3 per verse
- Alternative: Runway ML Gen-3 if Veo quality insufficient
- Can also use Sora when/if access available
- VTuber overlay version: same clips but with Sprotogremlin reaction cam
