/**
 * Biosphera - Lightweight Feedforward Neural Network for Evolution
 * Fast matrix computations, activation caching, and mutation.
 */

export interface BrainTopology {
  inputs: number;
  hiddens: number[];
  outputs: number;
}

export class NeuralNet {
  public topology: BrainTopology;
  // weights[layerIndex][toNeuron][fromNeuron]
  public weights: Float32Array[][];
  // biases[layerIndex][neuronIndex]
  public biases: Float32Array[];
  // cached activations for live visualization
  public layerActivations: Float32Array[];

  constructor(topology: BrainTopology, weights?: Float32Array[][], biases?: Float32Array[]) {
    this.topology = topology;
    const layerSizes = [topology.inputs, ...topology.hiddens, topology.outputs];

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

  private initializeRandom(layerSizes: number[]): void {
    for (let i = 0; i < layerSizes.length - 1; i++) {
      const fromSize = layerSizes[i];
      const toSize = layerSizes[i + 1];

      // Xavier/Glorot uniform initialization
      const scale = Math.sqrt(6 / (fromSize + toSize));
      const layerWeights: Float32Array[] = [];
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

  /**
   * Fast forward pass with tanh activation (outputs bounded in [-1, 1])
   */
  public feedForward(inputs: number[] | Float32Array): Float32Array {
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
        // Hyperbolic tangent activation
        nextActivations[j] = Math.tanh(sum);
      }
    }

    return this.layerActivations[this.layerActivations.length - 1];
  }

  /**
   * Clone the network with new memory allocations
   */
  public clone(): NeuralNet {
    return new NeuralNet(this.topology, this.weights, this.biases);
  }

  /**
   * Mutate weights and biases
   * @param mutationRate Probability of each weight/bias mutating
   * @param mutationPower Max perturbation applied
   */
  public mutate(mutationRate: number = 0.08, mutationPower: number = 0.25): void {
    for (let l = 0; l < this.weights.length; l++) {
      const layerWeights = this.weights[l];
      const layerBiases = this.biases[l];

      for (let j = 0; j < layerWeights.length; j++) {
        const neuronWeights = layerWeights[j];
        for (let k = 0; k < neuronWeights.length; k++) {
          if (Math.random() < mutationRate) {
            // Gaussian-like perturbation
            const delta = (Math.random() * 2 - 1 + Math.random() * 2 - 1) * 0.5 * mutationPower;
            neuronWeights[k] += delta;
            // Clamp weights to [-3, 3] to avoid explosive activations
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

  public serialize(): object {
    return {
      topology: this.topology,
      weights: this.weights.map(layer => layer.map(w => Array.from(w))),
      biases: this.biases.map(b => Array.from(b))
    };
  }

  public static deserialize(data: any): NeuralNet {
    const weights = data.weights.map((layer: number[][]) => layer.map(w => new Float32Array(w)));
    const biases = data.biases.map((b: number[]) => new Float32Array(b));
    return new NeuralNet(data.topology, weights, biases);
  }
}
