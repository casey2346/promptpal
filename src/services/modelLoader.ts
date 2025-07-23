// src/services/modelLoader.ts

export async function loadModel() {
  return {
    infer: async (input: any) => {
      return { output: "Result for " + JSON.stringify(input) };
    },
  };
}

export function getModelInfo(_model: any) {
  return {
    type: "SAM",
    version: "vit_h",
    quantized: true,
  };
}

export async function switchModel(modelType: string) {
  return await loadModel();
}
