/**
 * Biosphera - Live Scientific Challenges Engine
 * Evaluates ecological & evolutionary milestones against the living biosphere.
 */

const CHALLENGE_DEFS = [
  {
    id: 'apex_predator',
    title: 'Apex Predator',
    description: 'Evolve a carnivore (diet > 0.65) reaching Gen 5+ with 3+ kills.',
    target: 3
  },
  {
    id: 'speciation',
    title: 'Adaptive Radiation',
    description: 'Have 3+ distinct active species coexisting.',
    target: 3
  },
  {
    id: 'winter_survivor',
    title: 'Winter Survivor',
    description: 'Survive with 30+ living organisms during Winter season.',
    target: 30
  },
  {
    id: 'century_lineage',
    title: 'Deep Lineage',
    description: 'Reach Generation 10+ in a living organism.',
    target: 10
  }
];

export class Challenges {
  constructor() {
    this.completedIds = new Set();
    this.challenges = CHALLENGE_DEFS.map((def) => ({
      ...def,
      progress: 0,
      completed: false
    }));
  }

  evaluate(world, speciesRegistry, seasonCycle) {
    const organisms = world?.organisms ?? [];
    const speciesCount = speciesRegistry?.species?.length ?? 0;
    const season = seasonCycle?.getSeason?.() ?? 'spring';

    let bestApexKills = 0;
    let maxLivingGen = 0;
    for (let i = 0; i < organisms.length; i++) {
      const org = organisms[i];
      if (org.generation > maxLivingGen) {
        maxLivingGen = org.generation;
      }
      if (org.dna?.diet > 0.65 && org.generation >= 5 && org.kills > bestApexKills) {
        bestApexKills = org.kills;
      }
    }

    const rawProgress = {
      apex_predator: Math.min(3, bestApexKills),
      speciation: Math.min(3, speciesCount),
      winter_survivor: season === 'winter' ? Math.min(30, organisms.length) : 0,
      century_lineage: Math.min(10, maxLivingGen)
    };

    const newlyCompleted = [];
    this.challenges = CHALLENGE_DEFS.map((def) => {
      const wasCompleted = this.completedIds.has(def.id);
      const current = rawProgress[def.id] ?? 0;
      const isNowCompleted = wasCompleted || current >= def.target;

      if (isNowCompleted && !wasCompleted) {
        this.completedIds.add(def.id);
        newlyCompleted.push(def.id);
      }

      return {
        id: def.id,
        title: def.title,
        description: def.description,
        progress: isNowCompleted ? def.target : current,
        target: def.target,
        completed: isNowCompleted
      };
    });

    return {
      challenges: this.challenges,
      newlyCompleted
    };
  }
}
