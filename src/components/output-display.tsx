import React from 'react';
import './output-display.css';
import { LogEntry } from '../engine/js-executor-engine';

export interface OutputDisplayProps {
  logs: LogEntry[];
  returnValue?: string;
  error?: string;
  isLoading: boolean;
  onClear: () => void;
}

export const OutputDisplay: React.FC<OutputDisplayProps> = ({
  logs,
  returnValue,
  error,
  isLoading,
  onClear
}) => {
  const hasContent = logs.length > 0 || returnValue || error;

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
        
        {!error && logs.length > 0 && (
          <div className="console-output">
            {logs.map((log, index) => (
              <div key={`${log.timestamp}-${index}`} className={`log-entry log-${log.type}`}>
                <div className="log-content">
                  <pre>{log.content}</pre>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {!error && returnValue && (
          <div className="return-value">
            <div className="return-label">↳ Return Value</div>
            <div className="return-content">
              <pre>{returnValue}</pre>
            </div>
          </div>
        )}
        
        {!hasContent && !isLoading && (
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
