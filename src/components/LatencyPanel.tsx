import React from 'react';
import { LatencyMetrics } from '../types';

interface LatencyPanelProps {
  metrics: LatencyMetrics;
}

export const LatencyPanel: React.FC<LatencyPanelProps> = ({ metrics }) => {
  const getColor = (value: number) => {
    if (value < 3000) return '#27ae60';
    if (value < 5000) return '#f39c12';
    return '#e74c3c';
  };

  return (
    <div style={{
      background: '#f8f9fa',
      borderRadius: '10px',
      padding: '20px',
      marginBottom: '20px',
    }}>
      <h3 style={{ marginBottom: '15px', fontSize: '16px' }}>⚡ Performance Metrics</h3>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '15px',
      }}>
        <MetricItem
          label="End-to-End Latency"
          value={metrics.end_to_end}
          color={getColor(metrics.end_to_end)}
          highlight
        />
        <MetricItem label="Recording Duration" value={metrics.recording} />
        <MetricItem label="STT" value={metrics.stt} />
        <MetricItem label="LLM Total" value={metrics.llm} />
        <MetricItem label="LLM First Token" value={metrics.llm_first_token} />
        <MetricItem label="TTS Total" value={metrics.tts} />
        <MetricItem label="TTS First Byte" value={metrics.tts_first_byte} />
      </div>
    </div>
  );
};

const MetricItem: React.FC<{
  label: string;
  value: number;
  color?: string;
  highlight?: boolean;
}> = ({ label, value, color = '#333', highlight = false }) => (
  <div style={{
    background: highlight ? '#fff5f5' : 'white',
    padding: '12px',
    borderRadius: '8px',
    borderLeft: `4px solid ${highlight ? '#e74c3c' : '#667eea'}`,
  }}>
    <div style={{ fontSize: '12px', color: '#666', marginBottom: '5px' }}>{label}</div>
    <div style={{ fontSize: '20px', fontWeight: 700, color }}>{value}ms</div>
  </div>
);
