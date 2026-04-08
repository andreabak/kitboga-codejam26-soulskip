# SoulSkip

A "Skip Ad" button that's actually a souls-like video game boss.  
If you want to skip the ad, you have to defeat the boss.

### Controls
Mouse:
- move ⇒ move
- left-click ⇒ attack
- right-click ⇒ defend/parry
- click on equipped items slots ⇒ use item / equipment (e.g. sword/shield)

Keyboard:
- move ⇒ W, A, S, D or arrows
- attack ⇒ Space
- defend ⇒ CTRL left or Shift Left
- cure ⇒ F

Touch:
- single touch move ⇒ move
- single tap ⇒ attack
- double touch/tap ⇒ defend
- double touch move ⇒ defend + move
- tap on equipped items slots ⇒ use item / equipment (e.g. sword/shield)

### Combat mechanics
Souls-like (Dark Souls, Elden Ring, etc.) combat with stamina and parry mechanics:
- moving fast (i.e. evade), attacking or defending consumes stamina
- with low stamina movement speed is reduced, cannot defend or attack or cure
- defending reduces received damage
- enemy attacks can be parried by defending right before the attack hits
- enemy stamina/stance can be broken with repeated parrying, temporarily preventing the enemy from attacking

### Configurability
Almost all settings, stats, timings, keybinds, etc. can be configured via the `config.js` file.  
The lightning/thunder flash effect at the beginning can be disabled in the enemy config.

### Source code
The original source code is written in TypeScript and compiled+bundled into a single JavaScript file using Vite with minification disabled.  
Given the large amount of assets (~75), in order to minimize browser requests all small-ish ones (<250kb) are inlined into a single module.  
For the TS source files see the repo at https://github.com/andreabak/kitboga-codejam26-soulskip/tree/main/src

### AI
I gave another shot at vibe-coding, but it's still far from usable and overall a very frustrating experience.
So I ditched that and all the code has been written from scratch by me, with the sole exception of the mobile touch gestures input which was a quick late addition partially done via OpenCode, and then tweaked/fixed by hand.  
I used AI for web search (via SearXNG + MCPs), rubber duck debugging (notepad would have done the job tho), and the occasional bug finding request (for which AI was wrong ~60% of the time).  
All AI models were run locally on my RTX3090, mostly Qwen3.5-9B or Qwen3.5-35B-A3B.

### Copyright and licenses notices
The project includes 3 short sound assets (under 8 seconds each) from the Elden Ring videogame used for comedic/meme effect; all original rights of those files remain with FromSoftware and Bandai Namco. The project is a non-commercial parody intended for satirical and educational use only. This usage is intended to fall under the Fair Use doctrine as a non-competitive, transformative work of satire. If needed these assets can be removed and replaced with other alternatives.

All other assets are free for commercial use.  
Assets licensed under CC BY 4.0 "attribution" license:
- music theme track from "Cinema Blockbuster Trailer 21" by Sascha Ende
- blood vfx assets from "Blood FX" by jasontomlee
- cure vfx assets from "Pixel Art VFX Priest" by frostwindz
- lightning vfx assets from "Lightning FX" by TotallyNotPixels
All other included assets not explicitly mentioned are royalty-free under CC0 "no rights reserved" license, sourced from freesound.org and itch.io.