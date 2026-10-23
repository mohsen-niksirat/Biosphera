/**
 * Biosphera - Gladiator Arena & Fitness Benchmark Trial
 * Tests an organism's evolutionary fitness in a standardized 3-phase challenge chamber.
 */

import { World } from './World.js';
import { Camera } from '../render/Camera.js';
import { Renderer } from '../render/Renderer.js';
import { Organism } from '../entities/Organism.js';
import { Food } from '../entities/Food.js';
import { Hazard } from '../entities/Hazard.js';

export class ArenaTrial {
  constructor(modalId, soundEngine, onCompleteCallback) {
    this.modal = document.getElementById(modalId);
    this.canvas = document.getElementById('arena-canvas');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.soundEngine = soundEngine;
    this.onComplete = onCompleteCallback;

    this.world = null;
    this.camera = null;
    this.renderer = null;
    this.testSubject = null;

    this.isRunning = false;
    this.timer = 0;
    this.maxDuration = 25; // 25 seconds total trial
    this.currentPhase = 1; // 1: Foraging, 2: Hazard avoidance, 3: Hunter evasion
    this.plantsEaten = 0;
    this.hazardDamageTaken = 0;
    this.hunter = null;
    this.animFrame = null;

    this.bindEvents();
  }

  bindEvents() {
    document.getElementById('btn-close-arena')?.addEventListener('click', () => {
      this.stop();
    });

    document.getElementById('btn-arena-done')?.addEventListener('click', () => {
      this.stop();
    });

    document.getElementById('btn-arena-retry')?.addEventListener('click', () => {
      if (this.testSubject) {
        this.start(this.testSubject.dna);
      }
    });
  }

  start(dna) {
    if (!this.modal || !this.canvas) return;

    this.modal.style.display = 'flex';
    document.getElementById('arena-results')?.classList.remove('show');
    document.getElementById('arena-live-hud')?.classList.add('show');

    // Mini arena world sized exactly to the 640x400 canvas (fully visible, no clipping)
    this.world = new World(640, 400);
    this.world.foods = [];
    this.world.hazards = [];
    this.world.organisms = [];
    this.world.foodSpawnRate = 0; // Trial food is placed deliberately per phase — no ambient spawning
    this.world.maxFoodCap = 200;

    this.camera = new Camera(0, 0, 1.0);
    this.renderer = new Renderer(this.canvas, this.camera);

    // Spawn test subject in center
    this.testSubject = new Organism(320, 200, dna.mutate(0, 0), 1, null, 120);
    this.world.organisms.push(this.testSubject);

    this.timer = 0;
    this.currentPhase = 1;
    this.plantsEaten = 0;
    this.hazardDamageTaken = 0;
    this.isRunning = true;
    this.hunter = null;

    // Spawn initial foraging test
    this.spawnPhaseOne();

    this.lastTime = performance.now();
    this.loop();
  }

  spawnPhaseOne() {
    this.world.foods = [];
    for (let i = 0; i < 22; i++) {
      const angle = (i / 22) * Math.PI * 2;
      const dist = 100 + Math.random() * 90;
      this.world.foods.push(new Food(320 + Math.cos(angle) * dist, 200 + Math.sin(angle) * dist, 'plant'));
    }
  }

  spawnPhaseTwo() {
    this.world.hazards.push(new Hazard(240, 150, 50, 40));
    this.world.hazards.push(new Hazard(400, 250, 50, 40));
    // Re-seed some food near hazards
    for (let i = 0; i < 15; i++) {
      this.world.foods.push(new Food(240 + Math.random() * 160, 140 + Math.random() * 120, 'plant'));
    }
  }

  spawnPhaseThree() {
    // Spawn apex robot predator drone chasing test subject
    const hunterDNA = this.testSubject.dna.mutate(0, 0);
    hunterDNA.speed = 3.8;
    hunterDNA.size = 18;
    hunterDNA.diet = 1.0; // strict carnivore
    this.hunter = new Organism(100, 100, hunterDNA, 99, 'drone', 300);
    this.world.organisms.push(this.hunter);
  }

  loop() {
    if (!this.isRunning) return;

    const now = performance.now();
    const dt = Math.min(0.1, (now - this.lastTime) / 1000);
    this.lastTime = now;

    this.timer += dt;
    const timeLeft = Math.max(0, this.maxDuration - this.timer);

    // Track Phase Transitions
    if (this.timer >= 8 && this.currentPhase === 1) {
      this.currentPhase = 2;
      this.spawnPhaseTwo();
      this.soundEngine?.playDisaster();
    } else if (this.timer >= 16 && this.currentPhase === 2) {
      this.currentPhase = 3;
      this.spawnPhaseThree();
      this.soundEngine?.playDisaster();
    }

    // Hunter AI pursuing subject (velocity in px/s)
    if (this.hunter && !this.hunter.isDead && !this.testSubject.isDead) {
      const dx = this.testSubject.x - this.hunter.x;
      const dy = this.testSubject.y - this.hunter.y;
      this.hunter.heading = Math.atan2(dy, dx);
      this.hunter.vx = Math.cos(this.hunter.heading) * 3.2 * 60;
      this.hunter.vy = Math.sin(this.hunter.heading) * 3.2 * 60;
    }

    // Step world simulation
    this.world.update(dt);

    // Track metrics
    this.plantsEaten = this.testSubject.plantsEaten;

    // Update HUD
    const elTimer = document.getElementById('arena-time');
    const elPhase = document.getElementById('arena-phase-title');
    const elFoodCount = document.getElementById('arena-food-count');
    const elHealthBar = document.getElementById('arena-subject-health');

    if (elTimer) elTimer.innerText = `${timeLeft.toFixed(1)}s`;
    if (elPhase) {
      elPhase.innerText = this.currentPhase === 1 ? 'Phase 1: Foraging Efficiency' : (this.currentPhase === 2 ? 'Phase 2: Hazard Navigation' : 'Phase 3: Hunter Evasion');
    }
    if (elFoodCount) elFoodCount.innerText = this.plantsEaten.toString();
    if (elHealthBar && this.testSubject) {
      const pct = Math.max(0, Math.min(100, (this.testSubject.energy / 120) * 100));
      elHealthBar.style.width = `${pct}%`;
    }

    // Render arena viewport
    this.renderer.render(this.world);

    // Check completion or death
    if (this.testSubject.isDead || this.timer >= this.maxDuration) {
      this.finishTrial();
      return;
    }

    this.animFrame = requestAnimationFrame(() => this.loop());
  }

  finishTrial() {
    this.isRunning = false;
    document.getElementById('arena-live-hud')?.classList.remove('show');

    // Compute Benchmark Score (0 - 100)
    const survivedTime = Math.min(this.maxDuration, this.timer);
    const timeScore = (survivedTime / this.maxDuration) * 40;
    const foragingScore = Math.min(40, this.plantsEaten * 3.5);
    const healthBonus = this.testSubject.isDead ? 0 : Math.min(20, (this.testSubject.energy / 120) * 20);
    const totalScore = Math.round(timeScore + foragingScore + healthBonus);

    let grade = 'Tier C';
    let gradeColor = '#94a3b8';
    if (totalScore >= 90) {
      grade = 'Tier S+ (Apex Specimen)';
      gradeColor = '#38bdf8';
    } else if (totalScore >= 78) {
      grade = 'Tier A (Highly Adapted)';
      gradeColor = '#10b981';
    } else if (totalScore >= 60) {
      grade = 'Tier B (Viable Organism)';
      gradeColor = '#facc15';
    } else if (totalScore >= 40) {
      grade = 'Tier C (Sub-optimal)';
      gradeColor = '#fb923c';
    } else {
      grade = 'Tier D (Evolutionary Dead-End)';
      gradeColor = '#f43f5e';
    }

    // Display Results Certificate
    const resPanel = document.getElementById('arena-results');
    const elGrade = document.getElementById('cert-grade');
    const elScore = document.getElementById('cert-score');
    const elPlants = document.getElementById('cert-plants');
    const elSurvival = document.getElementById('cert-time');

    if (elGrade) {
      elGrade.innerText = grade;
      elGrade.style.color = gradeColor;
    }
    if (elScore) elScore.innerText = `${totalScore} / 100`;
    if (elPlants) elPlants.innerText = `${this.plantsEaten} units`;
    if (elSurvival) elSurvival.innerText = `${survivedTime.toFixed(1)}s`;

    resPanel?.classList.add('show');
    this.soundEngine?.playBirth();

    this.onComplete?.({
      score: totalScore,
      grade,
      survived: !this.testSubject.isDead,
      dna: this.testSubject.dna
    });
  }

  stop() {
    this.isRunning = false;
    if (this.animFrame) {
      cancelAnimationFrame(this.animFrame);
      this.animFrame = null;
    }
    if (this.modal) this.modal.style.display = 'none';
  }
}
