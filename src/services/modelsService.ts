export interface ModelInfo {
  id: string;
  created: number;
}

export class ModelsService {
  private cachedModels: ModelInfo[] | null = null;

  async fetchModels(): Promise<ModelInfo[]> {
    if (this.cachedModels) {
      return this.cachedModels;
    }

    try {
      const response = await fetch('/api/models');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      const models = data.models || [];
      this.cachedModels = models;
      return models;
    } catch (error) {
      console.error('Error fetching models:', error);
      // Return default models if API fails
      return [
        { id: 'gpt-4o-mini', created: Date.now() / 1000 },
        { id: 'gpt-4o', created: Date.now() / 1000 },
        { id: 'gpt-4-turbo', created: Date.now() / 1000 },
      ];
    }
  }

  clearCache(): void {
    this.cachedModels = null;
  }
}
