import React, { useState, useEffect, useCallback } from 'react';
import { CodeEditor } from './components/code-editor';
import { OutputDisplay } from './components/output-display';
import { JSExecutorEngine } from './engine/js-executor-engine';
import './js-executor.css';

const defaultCode = `// 欢迎使用 JavaScript 执行器

import moo from 'moo';
console.log('Moo 模块已加载:', moo);
console.log('Hello, QuickJS!');

// 尝试一些计算
const fibonacci = (n) => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
};

console.log('斐波那契数列前10项:');
for (let i = 0; i < 10; i++) {
  console.log(\`fib(\${i}) = \${fibonacci(i)}\`);
}

// 返回一个值
const result = {
  message: '代码执行成功！',
  timestamp: new Date().toISOString(),
  random: Math.random()
};

result;`;

const JSExecutor: React.FC = () => {
  const [code, setCode] = useState(defaultCode);
  const [output, setOutput] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [isLoading, setIsLoading] = useState(false);
  const [executor] = useState(() => new JSExecutorEngine());

  // 初始化执行引擎
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

  // 执行代码
  const executeCode = useCallback(async () => {
    if (!executor.isReady()) {
      setError('执行引擎尚未初始化');
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

  // 清空输出
  const clearOutput = useCallback(() => {
    setOutput('');
    setError(undefined);
  }, []);

  // 重置所有状态
  const resetAll = useCallback(() => {
    clearOutput();
  }, [clearOutput]);

  return (
    <div className="js-executor">
      <div className="main-content">
        <CodeEditor
          code={code}
          onChange={setCode}
          onExecute={executeCode}
          onReset={resetAll}
          onClear={clearOutput}
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
