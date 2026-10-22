/**
 * Biosphera - Evolutionary Achievements & Trophies System
 * Celebrates evolutionary milestones, emergent behaviors, and survival triumphs.
 */

export class AchievementsEngine {
  constructor(storageKey = 'biosphera_achievements') {
    this.storageKey = storageKey;
    this.trophies = [
      {
        id: 'genesis',
        icon: '🌱',
        title: 'Primordial Genesis',
        description: 'Initiate your very first digital ecosystem.',
        unlocked: false
      },
      {
        id: 'century_club',
        icon: '🧬',
        title: 'Century Club',
        description: 'Reach Generation 25 through pure natural selection.',
        unlocked: false
      },
      {
        id: 'apex_predator',
        icon: '🦖',
        title: 'Apex Predator',
        description: 'An evolved carnivore claims 3 or more kills in its lifetime.',
        unlocked: false
      },
      {
        id: 'peaceful_grazer',
        icon: '🌿',
        title: 'Master Grazer',
        description: 'An evolved herbivore consumes over 30 plants.',
        unlocked: false
      },
      {
        id: 'methuselah',
        icon: '👴',
        title: 'Ancient Elder',
        description: 'An organism survives past 120 seconds in the wild.',
        unlocked: false
      },
      {
        id: 'ice_survivor',
        icon: '🧊',
        title: 'Ice Age Survivor',
        description: 'The colony endures a prolonged glacial freeze.',
        unlocked: false
      },
      {
        id: 'mutant_x',
        icon: '☢️',
        title: 'Cosmic Mutant',
        description: 'Offspring born with radical mutations from radiation.',
        unlocked: false
      },
      {
        id: 'pop_explosion',
        icon: '📈',
        title: 'Ecological Boom',
        description: 'Active living population exceeds 70 organisms.',
        unlocked: false
      },
      {
        id: 'bio_engineer',
        icon: '🔬',
        title: 'Genetic Architect',
        description: 'Engineer and inject a custom creature from the Gene Lab.',
        unlocked: false
      },
      {
        id: 'dna_globetrotter',
        icon: '📤',
        title: 'DNA Courier',
        description: 'Export an organism DNA string to your clipboard.',
        unlocked: false
      },
      {
        id: 'gladiator',
        icon: '⚔️',
        title: 'Coliseum Victor',
        description: 'Attain Tier A or Tier S+ in the Gladiator Fitness trial.',
        unlocked: false
      },
      {
        id: 'nocturnal_hunter',
        icon: '🌌',
        title: 'Nocturnal Hunter',
        description: 'Witness an apex predator hunting in deep bioluminescent night.',
        unlocked: false
      }
    ];

    this.onUnlock = null;
    this.loadState();
  }

  loadState() {
    try {
      const saved = localStorage.getItem(this.storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        for (const t of this.trophies) {
          if (parsed[t.id]) {
            t.unlocked = true;
            t.unlockedAt = parsed[t.id];
          }
        }
      }
    } catch {
      // Ignore local storage error
    }
  }

  saveState() {
    try {
      const state = {};
      for (const t of this.trophies) {
        if (t.unlocked) state[t.id] = t.unlockedAt;
      }
      localStorage.setItem(this.storageKey, JSON.stringify(state));
    } catch {
      // Ignore
    }
  }

  unlock(id) {
    const trophy = this.trophies.find(t => t.id === id);
    if (trophy && !trophy.unlocked) {
      trophy.unlocked = true;
      trophy.unlockedAt = new Date().toLocaleTimeString();
      this.saveState();
      this.onUnlock?.(trophy);
    }
  }

  checkMilestones(world) {
    if (world.organisms.length > 0) {
      this.unlock('genesis');
    }

    if (world.maxGeneration >= 25) {
      this.unlock('century_club');
    }

    if (world.organisms.length >= 70) {
      this.unlock('pop_explosion');
    }

    for (const org of world.organisms) {
      if (org.kills >= 3) {
        this.unlock('apex_predator');
      }
      if (org.plantsEaten >= 30) {
        this.unlock('peaceful_grazer');
      }
      if (org.age >= 120) {
        this.unlock('methuselah');
      }
    }
  }

  getUnlockedCount() {
    return this.trophies.filter(t => t.unlocked).length;
  }
}
