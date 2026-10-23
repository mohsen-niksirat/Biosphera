/**
 * Biosphera - Lightweight Feedforward Neural Network for Evolution
 */

export const DEFAULT_BRAIN_TOPOLOGY = {
  inputs: 9, // 7 sensory + bias + pheromone scent
  hiddens: [7],
  outputs: 4
};

export class NeuralNet {
  constructor(topology, weights, biases) {
    this.topology = topology || DEFAULT_BRAIN_TOPOLOGY;
    const layerSizes = [this.topology.inputs, ...this.topology.hiddens, this.topology.outputs];

    this.weights = [];
    this.biases = [];
    this.layerActivations = layerSizes.map(size => new Float32Array(size));

    if (weights && biases) {
      this.weights = weights.map(layer => layer.map(w => new Float32Array(w)));
      this.biases = biases.map(b => new Float32Array(b));
    } else {
      this.initializeRandom(layerSizes);
    }
  }

  initializeRandom(layerSizes) {
    for (let i = 0; i < layerSizes.length - 1; i++) {
      const fromSize = layerSizes[i];
      const toSize = layerSizes[i + 1];
      const scale = Math.sqrt(6 / (fromSize + toSize));
      const layerWeights = [];
      const layerBiases = new Float32Array(toSize);

      for (let to = 0; to < toSize; to++) {
        const neuronWeights = new Float32Array(fromSize);
        for (let from = 0; from < fromSize; from++) {
          neuronWeights[from] = (Math.random() * 2 - 1) * scale;
        }
        layerWeights.push(neuronWeights);
        layerBiases[to] = (Math.random() * 2 - 1) * 0.1;
      }

      this.weights.push(layerWeights);
      this.biases.push(layerBiases);
    }
  }

  feedForward(inputs) {
    const inputLayer = this.layerActivations[0];
    for (let i = 0; i < inputLayer.length; i++) {
      inputLayer[i] = inputs[i] || 0;
    }

    for (let l = 0; l < this.weights.length; l++) {
      const prevActivations = this.layerActivations[l];
      const nextActivations = this.layerActivations[l + 1];
      const layerWeights = this.weights[l];
      const layerBiases = this.biases[l];

      for (let j = 0; j < nextActivations.length; j++) {
        let sum = layerBiases[j];
        const neuronWeights = layerWeights[j];
        for (let k = 0; k < prevActivations.length; k++) {
          sum += neuronWeights[k] * prevActivations[k];
        }
        nextActivations[j] = Math.tanh(sum);
      }
    }

    return this.layerActivations[this.layerActivations.length - 1];
  }

  clone() {
    return new NeuralNet(this.topology, this.weights, this.biases);
  }

  mutate(mutationRate = 0.08, mutationPower = 0.25) {
    for (let l = 0; l < this.weights.length; l++) {
      const layerWeights = this.weights[l];
      const layerBiases = this.biases[l];

      for (let j = 0; j < layerWeights.length; j++) {
        const neuronWeights = layerWeights[j];
        for (let k = 0; k < neuronWeights.length; k++) {
          if (Math.random() < mutationRate) {
            const delta = (Math.random() * 2 - 1 + Math.random() * 2 - 1) * 0.5 * mutationPower;
            neuronWeights[k] += delta;
            if (neuronWeights[k] > 3) neuronWeights[k] = 3;
            else if (neuronWeights[k] < -3) neuronWeights[k] = -3;
          }
        }

        if (Math.random() < mutationRate) {
          layerBiases[j] += (Math.random() * 2 - 1) * mutationPower;
          if (layerBiases[j] > 2) layerBiases[j] = 2;
          else if (layerBiases[j] < -2) layerBiases[j] = -2;
        }
      }
    }
  }

  serialize() {
    return {
      topology: this.topology,
      weights: this.weights.map(layer => layer.map(w => Array.from(w))),
      biases: this.biases.map(b => Array.from(b))
    };
  }

  static deserialize(data) {
    const weights = data.weights.map(layer => layer.map(w => new Float32Array(w)));
    const biases = data.biases.map(b => new Float32Array(b));
    return new NeuralNet(data.topology, weights, biases);
  }
}
