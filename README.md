# 🧬 Biosphera

> **In-browser digital life simulation powered by genetic algorithms, tiny neural networks, and natural selection.**  
> *Zero dependencies. 100% Client-Side. 60 FPS Emergent Evolution.*

---

## 🌟 Highlights & Overview

**Biosphera** is an interactive, zero-dependency artificial life sandbox running directly in the browser. 

Unlike traditional rule-based cellular automata or particle visualizers, each organism in **Biosphera** possesses:
1. **Digital Genome (DNA):** Encodes physical traits (mass, top speed, sensory range, field-of-view, dietary orientation) and metabolic rates.
2. **Micro Neural Network Brain:** A fast feedforward perceptron ($8 \text{ inputs} \rightarrow 7 \text{ hidden} \rightarrow 4 \text{ outputs}$) that processes live sensory stimuli (distance and angle to plants, prey, predators, and toxic hazards) to steer and accelerate.
3. **Emergent Natural Selection:** No behaviors are hardcoded. In early generations, organisms wander randomly; within 10–20 generations, smart grazing, predator evasion, ambush hunting, and schooling behaviors emerge spontaneously.

---

## ✨ Key Features

- **🌙 Circadian Day/Night & Bioluminescent Deep:** Smooth diurnal transitions through daylight, twilight, and deep night. At night, photosynthesis pauses while organisms and vegetation emanate glowing bioluminescent neon halos and trails!
- **👁️ Multi-Spectrum Vision Overlays:** Switch view modes between *Natural View*, *Sensory Mesh* (visualizes the collective neural perception field and target locks of all organisms simultaneously), and *Kinetic Heatmap* (radiant thermal trails proportional to speed and hunting energy).
- **⚔️ Gladiator Arena & Fitness Benchmark:** Put any specimen through a rigorous 3-phase standardized coliseum trial (Foraging speed, Hazard navigation, and Hunter drone evasion) to evaluate its adaptive fitness score (0–100) and award an official Specimen Fitness Certificate (Tier S+, A, B, C, D).
- **🎨 Interactive God Brush & Shockwave Ripples:** Direct tactile interaction with the living water — switch brushes to sow plant colonies, drop nutrient meat, plant toxic vents, or trigger physical water shockwaves that push organisms and food away!
- **🔬 Genetic Engineering Laboratory (Gene Lab):** Design custom organisms with real-time swimming preview, interactive trait sliders (size, speed, vision cone, diet niche, hue), and estimated basal/kinetic burn rates before releasing them into the wild.
- **🏆 Evolutionary Achievements (10 Trophies):** Unlocks persistent trophies as your biosphere hits survival milestones (Century Club, Apex Predator, Master Grazer, Ice Age Survivor, Cosmic Mutant).
- **📱 Progressive Web App (PWA):** Installs as a standalone offline desktop/mobile app via `manifest.json` and service worker caching with zero server dependency.
- **🔬 Microscope Inspector:** Click on any swimming organism to inspect its internal state in real-time:
  - **Live Neural Visualizer:** Animated graph of inputs, hidden neurons, and outputs glowing as synapses fire.
  - **Genetics & Lineage:** Generation number, age, reproductive count, diet classification (Herbivore 🌿, Carnivore 🥩, Omnivore 🌾).
  - **Target Tracking Camera:** Smoothly follows your chosen specimen across the biome.
- **📈 Lotka-Volterra Ecology Chart:** Real-time scrolling population dynamics graph displaying predator-prey oscillations and vegetation abundance.
- **🔊 Procedural WebAudio Soundscape:** Synthesizes an ambient deep-ocean drone and organic SFX (mitosis chimes, feeding bubble pops, predatory bites, disaster rumbles) without loading external audio assets.
- **🌍 Biome Starting Scenarios:**
  - **🏝️ Primordial Reef:** Balanced baseline conditions for peaceful evolutionary growth.
  - **🥩 Predator Wasteland:** Scarce food and high aggression, testing predatory hunting instincts.
  - **☢️ Radiation Trench:** Hyper-mutation rates and toxic vents for accelerated evolutionary leaps.
  - **❄️ Glacial Tundra:** Sub-zero freeze testing metabolic fuel conservation and survival.
- **⚡ Spatial Hash Engine ($O(1)$ Queries):** Optimized spatial partitioning grid allows hundreds of entities to interact and sense at silky-smooth 60 FPS without $O(N^2)$ bottlenecks.
- **🌋 God Mode Interventions:**
  - **❄️ Ice Age:** Freezes vegetation growth, putting high metabolic stress on organisms.
  - **☢️ Cosmic Radiation Flare:** Triggers massive random mutations across the living population.
  - **🍃 Food Bloom:** Injects nutrient-rich plant clusters.
  - **🧪 Toxic Thermal Vents:** Spawns hazardous zones that damage health, teaching organisms to steer clear.
- **🧬 Shareable DNA Export / Import:**
  - Export any thriving organism as an encoded string.
  - Import custom DNA strings to test evolutionary fitness across different biospheres!

---

## 🏗️ Architecture & Modules

```
Biosphera/
├── index.html              # Modern cyber-biological glassmorphic UI
├── src/
│   ├── style.css           # Dark theme design system & layout
│   ├── main.js             # Simulation loop & event dispatcher
│   ├── audio/
│   │   └── SoundEngine.js  # Procedural WebAudio synth & soundscape
│   ├── brain/
│   │   └── NeuralNet.js    # Multi-layer perceptron with fast tanh & mutation
│   ├── genetics/
│   │   └── DNA.js          # Genetic encoding, crossover, & serialization
│   ├── engine/
│   │   ├── SpatialHash.js  # High-performance O(1) neighbor search
│   │   └── World.js        # Ecosystem rules, disasters, & presets
│   ├── entities/
│   │   ├── Organism.js     # Living agent: sense, think, act, reproduce, die
│   │   ├── Food.js         # Plant nutrition & rotting meat pellets
│   │   └── Hazard.js       # Toxic pools & damage areas
│   ├── render/
│   │   ├── Camera.js       # Pan, zoom, & follow-target viewport
│   │   └── Renderer.js     # Canvas 2D rendering with multi-joint flagella & plankton
│   └── ui/
│       ├── Inspector.js    # Microscope panel & live neural visualizer
│       ├── Controls.js     # Top stats HUD, speed control, & God mode
│       └── PopulationChart.js # Real-time predator-prey dynamics chart
└── README.md
```

---

## 🚀 Quick Start (Zero Build Required!)

Because Biosphera is built with pure modern ES modules, you don't even need to run `npm install`:

1. **Option A (Instant in Browser):**
   - Simply double-click `index.html` or open it with **VS Code Live Server**.
2. **Option B (Any HTTP Server):**
   ```bash
   # Python
   python -m http.server 3000
   
   # Or Node.js
   npx serve .
   ```
3. Open `http://localhost:3000` in your browser.

---

## 🎮 Controls

| Action | Control |
| :--- | :--- |
| **Pan Biome** | Click and drag on canvas |
| **Zoom Viewport** | Mouse scroll wheel |
| **Inspect Organism** | Click on any swimming organism |
| **Follow Target** | Click "🎯 Follow" inside the Microscope panel |
| **Simulation Speed** | Toggle `1x`, `2x`, `5x`, or `10x` in the bottom bar |
| **Pause / Resume** | Click `⏸ Pause` button |
| **Sound** | Toggle sound on/off with the `🔊 Sound` button in the top bar |
| **Ecology Chart** | Toggle the Lotka-Volterra graph with the `📈 Dynamics` button |

---

## 📄 License

MIT License © [Mohsen Niksirat](https://github.com/mohsen-niksirat)
