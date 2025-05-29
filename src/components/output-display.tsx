import React from 'react';
import './output-display.css';

export interface OutputDisplayProps {
  output: string;
  error?: string;
  isLoading: boolean;
  onClear: () => void;
}

export const OutputDisplay: React.FC<OutputDisplayProps> = ({
  output,
  error,
  isLoading,
  onClear
}) => {
  return (
    <div className="output-panel">
      <div className="panel-header">
        <h3>Execution Result</h3>
        <button onClick={onClear} className="btn btn-secondary">
          Clear Output
        </button>
      </div>
      
      <div className="output-container">
        {error && (
          <div className="error-output">
            <h4>❌ Error Message</h4>
            <pre>{error}</pre>
          </div>
        )}
        
        {output && !error && (
          <div className="success-output">
            <pre>{output}</pre>
          </div>
        )}
        
        {!output && !error && !isLoading && (
          <div className="placeholder">
            Click "Execute Code" button to run your JavaScript code
            <br />
            <small>Supports console.log output and return value display</small>
          </div>
        )}
        
        {isLoading && (
          <div className="loading">
            <div className="spinner"></div>
            Executing code...
          </div>
        )}
      </div>
    </div>
  );
};
