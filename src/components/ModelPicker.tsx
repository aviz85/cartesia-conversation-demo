import { useState, useEffect } from 'react';
import { ModelsService, ModelInfo } from '../services/modelsService';

interface ModelPickerProps {
  selectedModel: string;
  onModelChange: (model: string) => void;
  disabled?: boolean;
}

export const ModelPicker: React.FC<ModelPickerProps> = ({
  selectedModel,
  onModelChange,
  disabled = false,
}) => {
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const modelsService = new ModelsService();

    modelsService.fetchModels()
      .then((fetchedModels) => {
        setModels(fetchedModels);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Failed to load models:', err);
        setError('Failed to load models');
        setLoading(false);
      });
  }, []);

  if (loading) {
    return (
      <div style={{ fontSize: '14px', color: '#666' }}>
        Loading models...
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ fontSize: '14px', color: '#e74c3c' }}>
        {error}
      </div>
    );
  }

  return (
    <div style={{ marginBottom: '20px' }}>
      <label style={{
        display: 'block',
        marginBottom: '8px',
        fontSize: '14px',
        fontWeight: 600,
        color: '#333',
      }}>
        🤖 AI Model
      </label>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value)}
        disabled={disabled}
        style={{
          width: '100%',
          padding: '12px',
          fontSize: '14px',
          border: '2px solid #e0e0e0',
          borderRadius: '8px',
          background: 'white',
          cursor: disabled ? 'not-allowed' : 'pointer',
          opacity: disabled ? 0.6 : 1,
          transition: 'border-color 0.2s',
          outline: 'none',
        }}
        onFocus={(e) => {
          if (!disabled) {
            e.target.style.borderColor = '#667eea';
          }
        }}
        onBlur={(e) => {
          e.target.style.borderColor = '#e0e0e0';
        }}
      >
        {models.length === 0 ? (
          <option value="gpt-4o-mini">gpt-4o-mini (default)</option>
        ) : (
          models.map((model) => (
            <option key={model.id} value={model.id}>
              {model.id}
            </option>
          ))
        )}
      </select>
      <div style={{
        marginTop: '6px',
        fontSize: '12px',
        color: '#666',
      }}>
        Select which OpenAI model to use for conversation
      </div>
    </div>
  );
};
