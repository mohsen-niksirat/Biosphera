/**
 * Biosphera - Hall of Records
 * Persists all-time ecosystem records (oldest, most prolific, apex hunter...)
 * across sessions via localStorage.
 */

const STORAGE_KEY = 'biosphera_records';

export class HallOfFame {
  constructor() {
    this.records = {
      oldestAge: null,      // { value, gen, hue }
      mostChildren: null,
      mostKills: null,
      mostPlants: null,
      peakPopulation: null,
      maxGeneration: null
    };
    this.lastUpdate = 0;
    this.load();
  }

  load() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) Object.assign(this.records, JSON.parse(saved));
    } catch {
      // Ignore storage errors
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.records));
    } catch {
      // Ignore
    }
  }

  _better(a, b) {
    return (b === null || a.value > b.value) ? { value: a.value, gen: a.gen, hue: a.hue } : b;
  }

  update(world, now) {
    if (now - this.lastUpdate < 1000) return;
    this.lastUpdate = now;

    let changed = false;

    for (const org of world.organisms) {
      const claims = [
        ['oldestAge', org.age],
        ['mostChildren', org.childrenCount],
        ['mostKills', org.kills],
        ['mostPlants', org.plantsEaten],
        ['maxGeneration', org.generation]
      ];
      for (const [key, value] of claims) {
        if (value > 0) {
          const next = this._better({ value, gen: org.generation, hue: org.dna.colorHue }, this.records[key]);
          if (next !== this.records[key]) {
            this.records[key] = next;
            changed = true;
          }
        }
      }
    }

    const pop = world.organisms.length;
    const nextPop = this._better({ value: pop, gen: world.maxGeneration, hue: 200 }, this.records.peakPopulation);
    if (nextPop !== this.records.peakPopulation) {
      this.records.peakPopulation = nextPop;
      changed = true;
    }

    if (changed) this.save();
  }

  renderHTML() {
    const rows = [
      ['👴 Longest Lived', 'oldestAge', 's'],
      ['🐣 Most Offspring', 'mostChildren', 'children'],
      ['⚔️ Deadliest Hunter', 'mostKills', 'kills'],
      ['🍃 Most Plants Eaten', 'mostPlants', 'units'],
      ['📈 Peak Population', 'peakPopulation', 'organisms'],
      ['🌳 Deepest Generation', 'maxGeneration', 'gen']
    ];

    return rows.map(([label, key, unit]) => {
      const r = this.records[key];
      const val = r ? `${Math.round(r.value)} ${unit}` : '—';
      const meta = r ? ` <span class="text-muted">• Gen ${r.gen}</span>` : '';
      return `<div class="record-row"><span>${label}</span><span class="record-val">${val}${meta}</span></div>`;
    }).join('');
  }
}
