import React, { useState, useEffect, useRef } from 'react';
import { QuickJSAsyncWASMModule, newQuickJSAsyncWASMModule } from 'quickjs-emscripten';
import './js-runner.css';

const JSExecutor = () => {
  const [code, setCode] = useState(`// 欢迎使用 JavaScript 执行器

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

result;`);

  const [output, setOutput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const quickJSRef = useRef<QuickJSAsyncWASMModule | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  // 初始化 QuickJS
  useEffect(() => {
    const initQuickJS = async () => {
      try {
        const module = await newQuickJSAsyncWASMModule();
        quickJSRef.current = module;
      } catch (err) {
        setError('QuickJS 初始化失败: ' + (err instanceof Error ? err.message : String(err)));
      }
    };

    initQuickJS();

    return () => {
      // QuickJSWASMModule doesn't have a dispose method
      // The cleanup is handled automatically
    };
  }, []);

  // 处理 Tab 键缩进
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // 插入两个空格作为缩进
      const newValue = code.substring(0, start) + '  ' + code.substring(end);
      setCode(newValue);
      
      // 使用ref来设置光标位置，确保引用有效
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  // 执行 JavaScript 代码
  const executeCode = async () => {
    if (!quickJSRef.current) {
      setError('QuickJS 尚未初始化');
      return;
    }

    setIsLoading(true);
    setError('');
    setOutput('');

    try {
      const runtime = quickJSRef.current.newRuntime();
      // "Should be enough for everyone" -- attributed to B. Gates
      runtime.setMemoryLimit(1024 * 640);
      // Limit stack size
      runtime.setMaxStackSize(1024 * 320);
      // Interrupt computation after 1024 calls to the interrupt handler
      let interruptCycles = 0;
      runtime.setInterruptHandler(() => ++interruptCycles > 1024);
      // Toy module system that always returns the module name
      // as the default export
      runtime.setModuleLoader(async (moduleName) => `export default 'asdf-${moduleName}'`);

      const vm = runtime.newContext();
      const logs: string[] = [];

      // 重写 console.log 来捕获输出
      const consoleLogHandle = vm.newFunction('log', (...args) => {
        const nativeArgs = args.map(arg => vm.dump(arg));
        logs.push(nativeArgs.join(' '));
      });
      
      const consoleHandle = vm.newObject();
      vm.setProp(consoleHandle, 'log', consoleLogHandle);
      vm.setProp(vm.global, 'console', consoleHandle);

      // 执行代码
      const result = await vm.evalCodeAsync(code);
      
      let output = '';
      
      // 添加 console.log 输出
      if (logs.length > 0) {
        output += '=== Console 输出 ===\n';
        output += logs.join('\n') + '\n\n';
      }

      // 添加返回值
      if (result.error) {
        const error = vm.dump(result.error);
        console.error('执行错误:', output, error);
        throw new Error(output);
      } else {
        const returnValue = vm.dump(result.value);
        if (returnValue !== undefined) {
          output += '=== 返回值 ===\n';
          output += typeof returnValue === 'object' 
            ? JSON.stringify(returnValue, null, 2)
            : String(returnValue);
        }
      }

      setOutput(output || '代码执行完成，无输出');

      // 清理资源
      consoleLogHandle.dispose();
      consoleHandle.dispose();
      result.value?.dispose();
      vm.dispose();

    } catch (err) {
      setError('执行错误: ' + (err instanceof Error ? err.message : String(err)));
      console.error('执行错误:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 清空输出
  const clearOutput = () => {
    setOutput('');
    setError('');
  };

  // 重置代码
  const resetCode = () => {
    setCode(`// 在这里编写你的 JavaScript 代码
console.log('Hello, World!');

// 返回一个值
'执行成功！';`);
    clearOutput();
  };

  // 插入示例代码
  const insertExample = (example: string) => {
    const examples: Record<string, string> = {
      basic: `// 基础示例
console.log('Hello, QuickJS!');
const name = 'JavaScript';
console.log(\`欢迎学习 \${name}!\`);

// 简单计算
const sum = (a, b) => a + b;
console.log('2 + 3 =', sum(2, 3));

'基础示例执行完成';`,

      fibonacci: `// 斐波那契数列
const fibonacci = (n) => {
  if (n <= 1) return n;
  return fibonacci(n - 1) + fibonacci(n - 2);
};

console.log('斐波那契数列前10项:');
const result = [];
for (let i = 0; i < 10; i++) {
  const value = fibonacci(i);
  console.log(\`fib(\${i}) = \${value}\`);
  result.push(value);
}

result;`,

      array: `// 数组操作示例
const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

console.log('原数组:', numbers);

// 过滤偶数
const evenNumbers = numbers.filter(n => n % 2 === 0);
console.log('偶数:', evenNumbers);

// 计算平方
const squares = numbers.map(n => n * n);
console.log('平方:', squares);

// 求和
const sum = numbers.reduce((acc, n) => acc + n, 0);
console.log('总和:', sum);

{
  original: numbers,
  even: evenNumbers,
  squares: squares,
  sum: sum
};`,

      object: `// 对象操作示例
const person = {
  name: '张三',
  age: 25,
  city: '北京',
  hobbies: ['读书', '游泳', '编程']
};

console.log('个人信息:', person);

// 添加新属性
person.email = 'zhangsan@example.com';
person.introduce = function() {
  return \`我是\${this.name}，今年\${this.age}岁，来自\${this.city}\`;
};

console.log('自我介绍:', person.introduce());
console.log('爱好数量:', person.hobbies.length);

person;`
    };

    setCode(examples[example]);
    clearOutput();
  };

  return (
    <div className="js-executor">
      <div className="header">
        <h2>JavaScript 代码执行器</h2>
        <p>基于 QuickJS-Emscripten 的在线 JavaScript 执行环境</p>
      </div>

      <div className="main-content">
        {/* 左侧编辑器 */}
        <div className="editor-panel">
          <div className="panel-header">
            <h3>代码编辑器</h3>
            <div className="editor-controls">
              <select 
                onChange={(e) => e.target.value && insertExample(e.target.value)}
                defaultValue=""
                className="example-select"
              >
                <option value="">选择示例代码</option>
                <option value="basic">基础示例</option>
                <option value="fibonacci">斐波那契数列</option>
                <option value="array">数组操作</option>
                <option value="object">对象操作</option>
              </select>
              <button onClick={resetCode} className="btn btn-secondary">
                重置代码
              </button>
              <button 
                onClick={executeCode} 
                disabled={isLoading}
                className="btn btn-primary"
              >
                {isLoading ? '执行中...' : '▶ 执行代码'}
              </button>
            </div>
          </div>
          
          <div className="editor-container">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="code-textarea"
              placeholder="在这里编写你的 JavaScript 代码..."
              spellCheck={false}
            />
            <div className="editor-info">
              <span>按 Tab 键缩进 | 行数: {code.split('\n').length} | 字符数: {code.length}</span>
            </div>
          </div>
        </div>

        {/* 右侧输出 */}
        <div className="output-panel">
          <div className="panel-header">
            <h3>执行结果</h3>
            <button onClick={clearOutput} className="btn btn-secondary">
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
            
            {output && (
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
      </div>
    </div>
  );
};

export default JSExecutor;
