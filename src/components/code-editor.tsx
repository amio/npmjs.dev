import React, { useRef } from 'react';

export interface CodeEditorProps {
  code: string;
  onChange: (code: string) => void;
  onExecute: () => void;
  onReset: () => void;
  onClear: () => void;
  isLoading: boolean;
}

const examples = {
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

const defaultCode = `// 在这里编写你的 JavaScript 代码
console.log('Hello, World!');

// 返回一个值
'执行成功！';`;

export const CodeEditor: React.FC<CodeEditorProps> = ({
  code,
  onChange,
  onExecute,
  onReset,
  onClear,
  isLoading
}) => {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.target as HTMLTextAreaElement;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      
      // 插入两个空格作为缩进
      const newValue = code.substring(0, start) + '  ' + code.substring(end);
      onChange(newValue);
      
      // 设置光标位置
      setTimeout(() => {
        if (textareaRef.current) {
          textareaRef.current.selectionStart = start + 2;
          textareaRef.current.selectionEnd = start + 2;
          textareaRef.current.focus();
        }
      }, 0);
    }
  };

  const insertExample = (example: string) => {
    onChange(examples[example as keyof typeof examples]);
    onClear();
  };

  const handleReset = () => {
    onChange(defaultCode);
    onReset();
  };

  return (
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
          <button onClick={handleReset} className="btn btn-secondary">
            重置代码
          </button>
          <button 
            onClick={onExecute} 
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
          onChange={(e) => onChange(e.target.value)}
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
  );
};
