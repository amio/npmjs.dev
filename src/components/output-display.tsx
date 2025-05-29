import React from 'react';

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
        <h3>执行结果</h3>
        <button onClick={onClear} className="btn btn-secondary">
          清空输出
        </button>
      </div>
      
      <div className="output-container">
        {error && (
          <div className="error-output">
            <h4>❌ 错误信息</h4>
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
            点击"执行代码"按钮来运行你的 JavaScript 代码
            <br />
            <small>支持 console.log 输出和返回值显示</small>
          </div>
        )}
        
        {isLoading && (
          <div className="loading">
            <div className="spinner"></div>
            正在执行代码...
          </div>
        )}
      </div>
    </div>
  );
};
