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
