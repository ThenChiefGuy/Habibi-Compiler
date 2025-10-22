import React, { useState, useEffect, useRef } from 'react';
import { Play, Trash2, Code2, Terminal, FileCode, Zap, Monitor } from 'lucide-react';

const CodeCompiler = () => {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [output, setOutput] = useState<Array<{ text: string; type: string }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [userInput, setUserInput] = useState('');
  const [inputResolve, setInputResolve] = useState<((val: string) => void) | null>(null);
  const [pyodide, setPyodide] = useState<any>(null);

  const outputRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const examples = {
    python: `# Python Example
name = input("What is your name: ")
age = int(input("How old are you: "))
for i in range(3):
    print(f"Hello {name}, you are {age} years old. Loop {i+1}")`,
    java: `// Java Example
// Coming soon!`,
    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hello World</title>
    <style>
        body { font-family: Arial, sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: linear-gradient(135deg, #667eea, #764ba2); }
        h1 { color: white; font-size: 48px; text-shadow: 2px 2px 4px rgba(0,0,0,0.3); }
    </style>
</head>
<body>
    <h1>Hello, World!</h1>
</body>
</html>`
  };

  // ----------------- Load Pyodide Dynamically -----------------
  useEffect(() => {
    const loadPy = async () => {
      addOutput('Loading Python runtime...', 'info');
      const py = await (window as any).loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/'
      });
      setPyodide(py);
      addOutput('Python runtime loaded ✅', 'info');
    };

    if (!(window as any).loadPyodide) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.23.4/full/pyodide.js';
      script.onload = loadPy;
      document.body.appendChild(script);
    } else {
      loadPy();
    }
  }, []);

  // ----------------- Load Example Code -----------------
  useEffect(() => {
    if (!code || Object.values(examples).includes(code)) {
      setCode(examples[language]);
    }
    setOutput([]);
  }, [language]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output, waitingForInput]);

  const addOutput = (text: string, type: string = 'output') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  const clearOutput = () => setOutput([]);

  // ----------------- Input Handling -----------------
  const getInput = (prompt: string) => {
    setInputPrompt(prompt);
    setWaitingForInput(true);
    setUserInput('');
    return new Promise<string>(resolve => setInputResolve(() => resolve));
  };

  const handleInputSubmit = () => {
    if (userInput.trim() && inputResolve) {
      inputResolve(userInput.trim());
      setUserInput('');
      setInputResolve(null);
      setWaitingForInput(false);
    }
  };

  // ----------------- Python Runner -----------------
  const runPython = async (code: string) => {
    if (!pyodide) {
      addOutput('Python runtime is not ready yet!', 'error');
      return;
    }

    addOutput('>>> Python Execution Started', 'info');
    addOutput('', 'output');

    (window as any).get_input = async (prompt: string) => {
      const val = await getInput(prompt);
      addOutput(`${prompt} ${val}`, 'input');
      return val;
    };

    try {
      await pyodide.runPythonAsync(`
from js import get_input
__input = get_input
def input(prompt=""):
    return __input(prompt)
`);
      await pyodide.runPythonAsync(code);
      addOutput('', 'output');
      addOutput('>>> Execution Completed Successfully', 'info');
    } catch (err) {
      addOutput('Error: ' + (err as Error).message, 'error');
    }
  };

  // ----------------- Java Runner -----------------
  const runJava = async () => {
    addOutput('>>> Java execution is coming soon!', 'info');
  };

  // ----------------- HTML Runner -----------------
  const runHTML = (code: string) => {
    if (outputRef.current) {
      const iframe = document.createElement('iframe');
      iframe.style.cssText = 'width:100%;height:100%;border:none;background:white;border-radius:8px;';
      outputRef.current.innerHTML = '';
      outputRef.current.appendChild(iframe);
      const doc = iframe.contentDocument || iframe.contentWindow?.document;
      if (doc) {
        doc.open();
        doc.write(code);
        doc.close();
      }
    }
  };

  // ----------------- Run Handler -----------------
  const handleRun = async () => {
    setIsRunning(true);
    clearOutput();
    if (language === 'python') await runPython(code);
    else if (language === 'java') await runJava();
    else if (language === 'html') runHTML(code);
    setIsRunning(false);
  };

  // ----------------- Tab Handling -----------------
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      setTimeout(() => { target.selectionStart = target.selectionEnd = start + 4; }, 0);
    }
  };

  // ----------------- Syntax Highlighting -----------------
  const highlightCode = (code: string, lang: string) => {
    let escaped = code.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const keywords = {
      python: ['def','return','if','else','elif','for','in','range','import','from','class','True','False','None','and','or','not','while','break','continue','pass','try','except','finally','with','as','lambda','yield'],
      java: ['public','private','protected','static','void','int','double','float','String','boolean','class','return','if','else','for','while','new','this','super','extends','implements','import','package','true','false','null','try','catch','finally','throw','throws'],
      html: ['DOCTYPE','html','head','body','title','style','script','div','span','a','img','input','button','form','meta','link']
    };
    const builtins = {
      python: ['print','len','range','str','int','float','list','dict','set','tuple','sum','min','max','abs','round','sorted','enumerate','zip','map','filter','input'],
      java: ['System','String','Math','Integer','Double','Boolean','Array','List','ArrayList','HashMap','println','print'],
      html: []
    };
    const langKeywords = keywords[lang as keyof typeof keywords] || [];
    const langBuiltins = builtins[lang as keyof typeof builtins] || [];
    let result = '';
    let i = 0;
    while(i < escaped.length){
      let matched = false;
      if(lang==='python' && escaped[i]==='#'){
        const end = escaped.indexOf('\n',i);
        const comment = end===-1?escaped.slice(i):escaped.slice(i,end);
        result+=`<span class="comment">${comment}</span>`;
        i+=comment.length; matched=true;
      }else if(lang==='java' && escaped.slice(i,i+2)==='//'){
        const end = escaped.indexOf('\n',i);
        const comment = end===-1?escaped.slice(i):escaped.slice(i,end);
        result+=`<span class="comment">${comment}</span>`;
        i+=comment.length; matched=true;
      } else if(escaped[i]==='"' || escaped[i]==="'"){
        const quote = escaped[i]; let j=i+1; let str=quote;
        while(j<escaped.length){
          if(escaped[j]==='\\' && j+1<escaped.length){ str+=escaped[j]+escaped[j+1]; j+=2;}
          else if(escaped[j]===quote){ str+=quote; j++; break;}
          else{ str+=escaped[j]; j++; }
        }
        result+=`<span class="string">${str}</span>`; i=j; matched=true;
      } else if(/\d/.test(escaped[i])){
        let num=''; while(i<escaped.length && /[\d.]/.test(escaped[i])){ num+=escaped[i]; i++; }
        result+=`<span class="number">${num}</span>`; matched=true;
      } else if(/[a-zA-Z_]/.test(escaped[i])){
        let word=''; while(i<escaped.length && /[a-zA-Z0-9_]/.test(escaped[i])){ word+=escaped[i]; i++; }
        const isFunc=escaped[i]==='(';
        if(langKeywords.includes(word)) result+=`<span class="keyword">${word}</span>`;
        else if(langBuiltins.includes(word)) result+=`<span class="builtin">${word}</span>`;
        else if(isFunc) result+=`<span class="function">${word}</span>`;
        else result+=word; matched=true;
      }
      if(!matched){ result+=escaped[i]; i++; }
    }
    return result;
  };

  const getLanguageIcon = () => {
    switch(language){
      case 'python': return <FileCode className="w-4 h-4" />;
      case 'java': return <Code2 className="w-4 h-4" />;
      case 'html': return <Monitor className="w-4 h-4" />;
      default: return <FileCode className="w-4 h-4" />;
    }
  };

  // ----------------- JSX -----------------
  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top Bar */}
      <div className="bg-card border-b border-border px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-glow">
            <Code2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Code Compiler
            </h1>
            <p className="text-xs text-muted-foreground">Professional IDE Environment</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary px-3 py-2 rounded-lg border border-border">
            {getLanguageIcon()}
            <select
              value={language}
              onChange={e=>setLanguage(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none cursor-pointer font-medium"
            >
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="html">HTML</option>
            </select>
          </div>
          <button onClick={handleRun} disabled={isRunning}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed">
            <Play className="w-4 h-4" /> {isRunning?'Running...':'Run Code'}
          </button>
          <button onClick={clearOutput}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-5 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg transition-all">
            <Trash2 className="w-4 h-4"/> Clear
          </button>
        </div>
      </div>

      {/* Editor & Output */}
      <div className="flex h-[calc(100vh-73px)]">
        {/* Editor */}
        <div className="flex-1 flex flex-col bg-background">
          <div className="bg-card px-4 py-2 border-b border-border text-sm text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-medium">Code Editor</span>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={e=>setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 w-full h-full p-6 bg-transparent text-transparent caret-primary font-mono text-sm resize-none focus:outline-none z-10"
              spellCheck={false} style={{lineHeight:'1.6',tabSize:4}}
            />
            <pre className="absolute inset-0 w-full h-full p-6 font-mono text-sm overflow-auto pointer-events-none"
              style={{lineHeight:'1.6'}}
              dangerouslySetInnerHTML={{__html:highlightCode(code,language)}}
            />
          </div>
        </div>

        {/* Output */}
        <div className="w-[45%] flex flex-col bg-console border-l border-border">
          <div className="bg-card px-4 py-2 border-b border-border text-sm text-muted-foreground flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent" />
            <span className="font-medium">Output Console</span>
          </div>
          <div ref={outputRef} className="flex-1 p-6 overflow-auto font-mono text-sm bg-[hsl(var(--console-bg))] flex flex-col">
            <div className="flex-1">
              {output.length===0 && !waitingForInput && (
                <div className="text-muted-foreground italic">Click "Run Code" to see output here...</div>
              )}
              {output.map((line,idx)=>(
                <div key={idx} className={`mb-1 ${
                  line.type==='info'?'text-primary font-semibold':
                  line.type==='success'?'text-green-400':
                  line.type==='error'?'text-destructive font-semibold':
                  line.type==='warning'?'text-yellow-400':
                  line.type==='input'?'text-blue-400':'text-foreground'
                }`}>{line.text||'\u00A0'}</div>
              ))}
            </div>
            {waitingForInput && (
              <div className="flex text-blue-400 font-mono mt-2">
                <span>{inputPrompt} </span>
                <input ref={inputRef} type="text" value={userInput}
                  onChange={e=>setUserInput(e.target.value)}
                  onKeyDown={e=>e.key==='Enter' && handleInputSubmit()}
                  className="bg-background border-b border-blue-400 focus:outline-none flex-1"
                  autoFocus
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <style>{`
        .keyword { color: hsl(330, 85%, 70%); font-weight: 600; }
        .string { color: hsl(135, 94%, 65%); }
        .number { color: hsl(271, 91%, 75%); }
        .comment { color: hsl(220, 15%, 55%); font-style: italic; }
        .function { color: hsl(190, 95%, 65%); }
        .builtin { color: hsl(50, 100%, 65%); }
        .bg-console { background: hsl(var(--console-bg)); }
        .shadow-glow { box-shadow: var(--shadow-glow); }
      `}</style>
    </div>
  );
};

export default CodeCompiler;
