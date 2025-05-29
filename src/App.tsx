import React, { useEffect } from 'react';

const App = () => {
  const [code, setCode] = React.useState('');

  useEffect(() => {
    setCode(`import moo from 'moo'`);
  }, []); // 添加依赖数组避免无限循环

  return (
    <div id="app">
      <Editor value={code} onChange={setCode} />
      <Terminal />
    </div>
  );
};

export default App;

function Editor(props: { value: string; onChange: (value: string) => void }) {
  return (
    <div id="editor">
      <textarea 
        value={props.value} 
        onChange={(e) => props.onChange(e.target.value)}
      ></textarea>
    </div>
  );
}

function Terminal() {
  return (
    <div id="terminal">
      <p>Terminal output will appear here.</p>
    </div>
  );
}
