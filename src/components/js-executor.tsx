import React, { useState, useEffect, useCallback } from 'react';
import { CodeEditor } from './code-editor';
import { OutputDisplay } from './output-display';
import { JSExecutorEngine } from '../engine/js-executor-engine';
import './js-executor.css';

// Parse package name from URL
const getPackageNameFromUrl = (): string => {
  const url = window.location.href;
  const match = url.match(/\/package\/([^\/\?#]+)/);
  return match ? match[1] : 'lodash'; // Default to lodash as example
};

// Generate example code based on package name
const generateExampleCode = (packageName: string): string => {
  // Convert package name to a valid variable name
  const variableName = packageName
    .replace(/[@\/\-\.]/g, '_')
    .replace(/^[0-9]/, '_$&') // Add underscore prefix if starts with number
    .replace(/[^a-zA-Z0-9_]/g, ''); // Remove other invalid characters

  return `import ${variableName} from '${packageName}'

console.log('${packageName} loaded:', ${variableName})`;
};

const JSExecutor: React.FC = () => {
  const packageName = getPackageNameFromUrl();
  const defaultCode = generateExampleCode(packageName);
  
  const [code, setCode] = useState(defaultCode);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [executor] = useState(() => new JSExecutorEngine());

  // Initialize execution engine
  useEffect(() => {
    let isMounted = true;

    const initializeEngine = async () => {
      try {
        await executor.initialize();
      } catch (err) {
        if (isMounted) {
          setError(err instanceof Error ? err.message : String(err));
        }
      }
    };

    initializeEngine();

    return () => {
      isMounted = false;
      executor.dispose();
    };
  }, [executor]);

  // Listen for URL changes and update code example
  useEffect(() => {
    const handleUrlChange = () => {
      const newPackageName = getPackageNameFromUrl();
      const newCode = generateExampleCode(newPackageName);
      setCode(newCode);
      setOutput('');
      setError(undefined);
    };

    // Listen for popstate events (browser back/forward)
    window.addEventListener('popstate', handleUrlChange);

    return () => {
      window.removeEventListener('popstate', handleUrlChange);
    };
  }, []);

  // Execute code
  const executeCode = useCallback(async () => {
    if (!executor.isReady()) {
      setError('Execution engine is not initialized yet');
      return;
    }

    setIsLoading(true);
    setError(undefined);
    setOutput('');

    try {
      const result = await executor.execute(code);
      setOutput(result.output);
      setError(result.error);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  }, [code, executor]);

  // Clear output
  const clearOutput = useCallback(() => {
    setOutput('');
    setError(undefined);
  }, []);

  return (
    <div className="js-executor">
      <div className="main-content">
        <CodeEditor
          code={code}
          onChange={setCode}
          onExecute={executeCode}
          isLoading={isLoading}
        />
        
        <OutputDisplay
          output={output}
          error={error}
          isLoading={isLoading}
          onClear={clearOutput}
        />
      </div>
    </div>
  );
};

export default JSExecutor;
