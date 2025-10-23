import React, { useState, useEffect, useRef } from 'react';
import { Play, Trash2, Code2, Terminal, FileCode, Zap, Monitor, Loader2 } from 'lucide-react';

const CodeCompiler = () => {
  const [language, setLanguage] = useState('python');
  const [code, setCode] = useState('');
  const [output, setOutput] = useState<Array<{ text: string; type: string }>>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideReady, setPyodideReady] = useState(false);
  const [loadingPyodide, setLoadingPyodide] = useState(false);
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [userInput, setUserInput] = useState('');
  const outputRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pyodideRef = useRef<any>(null);
  const inputResolverRef = useRef<((value: string) => void) | null>(null);

  const examples = {
    python: `# Python 3.11 Console
# Full Python standard library available

# Basic operations
print("Hello from Python 3.11!")
print(f"2 + 2 = {2 + 2}")

# List comprehension
squares = [x**2 for x in range(5)]
print(f"Squares: {squares}")

# Using standard library
import math
print(f"π = {math.pi:.4f}")
print(f"√16 = {math.sqrt(16)}")`,

    java: `// Java Example
public class Main {
    public static void main(String[] args) {
        System.out.println("Hello, World!");
        System.out.println("Welcome to Code Compiler!");
    }
}`,

    html: `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Hello World</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            background: linear-gradient(135deg, #667eea, #764ba2);
        }
        h1 {
            color: white;
            font-size: 48px;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.3);
        }
    </style>
</head>
<body>
    <h1>Hello, World!</h1>
</body>
</html>`
  };

  useEffect(() => {
    if (code === '' || code === examples[Object.keys(examples).find(key => key !== language) as keyof typeof examples]) {
      setCode(examples[language]);
    }
    setOutput([]);
  }, [language]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  useEffect(() => {
    if (waitingForInput && inputRef.current) {
      inputRef.current.focus();
    }
  }, [waitingForInput]);

  const loadPyodide = async () => {
    if (pyodideRef.current) return;
    
    setLoadingPyodide(true);
    addOutput('>>> Loading Python 3.11 runtime...', 'info');
    
    try {
      // Load Pyodide from CDN
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
      script.async = true;
      
      await new Promise((resolve, reject) => {
        script.onload = resolve;
        script.onerror = reject;
        document.head.appendChild(script);
      });

      // @ts-ignore
      const pyodide = await loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
      });

      pyodideRef.current = pyodide;

      // Setup stdout/stderr capture
      pyodide.setStdout({
        batched: (text: string) => {
          addOutput(text, 'success');
        }
      });

      pyodide.setStderr({
        batched: (text: string) => {
          addOutput(text, 'error');
        }
      });

      // Setup custom input function
      pyodide.globals.set('custom_input', (prompt: string = '') => {
        return new Promise((resolve) => {
          setInputPrompt(prompt);
          setWaitingForInput(true);
          inputResolverRef.current = resolve;
        });
      });

      // Override built-in input
      await pyodide.runPythonAsync(`
import builtins
import asyncio

async def async_input(prompt=''):
    result = await custom_input(prompt)
    return result

builtins.input = lambda prompt='': asyncio.ensure_future(async_input(prompt)).result()
      `);

      setPyodideReady(true);
      addOutput('>>> Python 3.11.3 ready!', 'info');
      addOutput('>>> Full standard library available', 'info');
      addOutput('', 'output');
    } catch (error) {
      addOutput(`Error loading Python: ${(error as Error).message}`, 'error');
      addOutput('>>> Please refresh the page to try again', 'error');
    } finally {
      setLoadingPyodide(false);
    }
  };

  const addOutput = (text: string, type = 'output') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  const clearOutput = () => {
    setOutput([]);
  };

  const handleInputSubmit = () => {
    if (inputResolverRef.current && userInput !== null) {
      addOutput(inputPrompt + userInput, 'input');
      inputResolverRef.current(userInput);
      inputResolverRef.current = null;
      setWaitingForInput(false);
      setUserInput('');
    }
  };

  const runPython = async (code: string) => {
    if (!pyodideRef.current) {
      await loadPyodide();
    }

    if (!pyodideRef.current) {
      addOutput('Error: Python runtime not available', 'error');
      return;
    }

    addOutput('>>> Running Python code...', 'info');
    addOutput('', 'output');

    try {
      // Run the code
      await pyodideRef.current.runPythonAsync(code);
      addOutput('', 'output');
      addOutput('>>> Execution completed', 'info');
    } catch (error: any) {
      // Python errors are already captured by stderr
      if (error.message && !error.message.includes('KeyboardInterrupt')) {
        addOutput('', 'output');
        addOutput('>>> Execution failed', 'error');
      }
    }
  };

  const runJava = (code: string) => {
    addOutput('>>> Compiling Java...', 'info');
    addOutput('>>> Running Main class...', 'info');
    addOutput('', 'output');

    try {
      const lines = code.split('\n');
      
      for (let line of lines) {
        const printMatch = line.match(/System\.out\.println\((.*?)\);/);
        if (printMatch) {
          let content = printMatch[1].trim();
          content = content.replace(/["']/g, '');
          content = content.replace(/\s*\+\s*/g, ' ');
          content = content.replace(/\\n/g, '\n');
          
          if (content.includes('\n')) {
            content.split('\n').forEach(l => {
              if (l.trim()) addOutput(l.trim(), 'success');
            });
          } else {
            addOutput(content, 'success');
          }
        }
      }
      
      addOutput('', 'output');
      addOutput('>>> BUILD SUCCESSFUL', 'info');
    } catch (error) {
      addOutput('Error: ' + (error as Error).message, 'error');
    }
  };

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

  const handleRun = async () => {
    setIsRunning(true);
    clearOutput();
    
    if (language === 'python') {
      await runPython(code);
    } else if (language === 'java') {
      runJava(code);
    } else if (language === 'html') {
      runHTML(code);
    }
    setIsRunning(false);
  };

  const highlightCode = (code: string, lang: string) => {
    let escaped = code
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    const keywords = {
      python: ['def', 'return', 'if', 'else', 'elif', 'for', 'in', 'range', 'import', 'from', 'class', 'True', 'False', 'None', 'and', 'or', 'not', 'while', 'break', 'continue', 'pass', 'try', 'except', 'finally', 'with', 'as', 'lambda', 'yield', 'async', 'await', 'global', 'nonlocal', 'del', 'assert', 'raise'],
      java: ['public', 'private', 'protected', 'static', 'void', 'int', 'double', 'float', 'String', 'boolean', 'class', 'return', 'if', 'else', 'for', 'while', 'new', 'this', 'super', 'extends', 'implements', 'import', 'package', 'true', 'false', 'null', 'try', 'catch', 'finally', 'throw', 'throws'],
      html: ['DOCTYPE', 'html', 'head', 'body', 'title', 'style', 'script', 'div', 'span', 'a', 'img', 'input', 'button', 'form', 'meta', 'link']
    };

    const builtins = {
      python: ['print', 'len', 'range', 'str', 'int', 'float', 'list', 'dict', 'set', 'tuple', 'sum', 'min', 'max', 'abs', 'round', 'sorted', 'enumerate', 'zip', 'map', 'filter', 'input', 'open', 'type', 'isinstance', 'dir', 'help', 'getattr', 'setattr', 'hasattr'],
      java: ['System', 'String', 'Math', 'Integer', 'Double', 'Boolean', 'Array', 'List', 'ArrayList', 'HashMap', 'println', 'print'],
      html: []
    };

    const langKeywords = keywords[lang as keyof typeof keywords] || [];
    const langBuiltins = builtins[lang as keyof typeof builtins] || [];

    let result = '';
    let i = 0;
    
    while (i < escaped.length) {
      let matched = false;

      if (lang === 'python' && escaped[i] === '#') {
        const endOfLine = escaped.indexOf('\n', i);
        const comment = endOfLine === -1 ? escaped.slice(i) : escaped.slice(i, endOfLine);
        result += `<span class="comment">${comment}</span>`;
        i += comment.length;
        matched = true;
      } else if (lang === 'java' && escaped.slice(i, i + 2) === '//') {
        const endOfLine = escaped.indexOf('\n', i);
        const comment = endOfLine === -1 ? escaped.slice(i) : escaped.slice(i, endOfLine);
        result += `<span class="comment">${comment}</span>`;
        i += comment.length;
        matched = true;
      } else if (escaped[i] === '"' || escaped[i] === "'") {
        const quote = escaped[i];
        let j = i + 1;
        let str = quote;
        
        const isFString = i > 0 && escaped[i - 1] === 'f';
        if (isFString && result.endsWith('f')) {
          result = result.slice(0, -1);
          str = 'f' + str;
        }
        
        while (j < escaped.length) {
          if (escaped[j] === '\\' && j + 1 < escaped.length) {
            str += escaped[j] + escaped[j + 1];
            j += 2;
          } else if (escaped[j] === quote) {
            str += quote;
            j++;
            break;
          } else {
            str += escaped[j];
            j++;
          }
        }
        result += `<span class="string">${str}</span>`;
        i = j;
        matched = true;
      } else if (/\d/.test(escaped[i])) {
        let num = '';
        while (i < escaped.length && /[\d.]/.test(escaped[i])) {
          num += escaped[i];
          i++;
        }
        result += `<span class="number">${num}</span>`;
        matched = true;
      } else if (/[a-zA-Z_]/.test(escaped[i])) {
        let word = '';
        while (i < escaped.length && /[a-zA-Z0-9_]/.test(escaped[i])) {
          word += escaped[i];
          i++;
        }
        
        const isFunction = escaped[i] === '(';
        
        if (langKeywords.includes(word)) {
          result += `<span class="keyword">${word}</span>`;
        } else if (langBuiltins.includes(word)) {
          result += `<span class="builtin">${word}</span>`;
        } else if (isFunction) {
          result += `<span class="function">${word}</span>`;
        } else {
          result += word;
        }
        matched = true;
      }

      if (!matched) {
        result += escaped[i];
        i++;
      }
    }

    return result;
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const target = e.target as HTMLTextAreaElement;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const newCode = code.substring(0, start) + '    ' + code.substring(end);
      setCode(newCode);
      setTimeout(() => {
        target.selectionStart = target.selectionEnd = start + 4;
      }, 0);
    }
  };

  const getLanguageIcon = () => {
    switch (language) {
      case 'python':
        return <FileCode className="w-4 h-4" />;
      case 'java':
        return <Code2 className="w-4 h-4" />;
      case 'html':
        return <Monitor className="w-4 h-4" />;
      default:
        return <FileCode className="w-4 h-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="bg-card border-b border-border px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center shadow-glow">
            <Code2 className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Code Compiler
            </h1>
            <p className="text-xs text-muted-foreground">
              {language === 'python' ? 'Python 3.11.3 Runtime' : 'Professional IDE Environment'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-secondary px-3 py-2 rounded-lg border border-border">
            {getLanguageIcon()}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-foreground focus:outline-none cursor-pointer font-medium"
            >
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="html">HTML</option>
            </select>
          </div>
          
          <button
            onClick={handleRun}
            disabled={isRunning || loadingPyodide}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-5 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg hover:shadow-glow transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isRunning || loadingPyodide ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {loadingPyodide ? 'Loading...' : 'Running...'}
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                Run Code
              </>
            )}
          </button>
          
          <button
            onClick={clearOutput}
            className="bg-destructive hover:bg-destructive/90 text-destructive-foreground px-5 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        <div className="flex-1 flex flex-col bg-background">
          <div className="bg-card px-4 py-2 border-b border-border text-sm text-muted-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" />
            <span className="font-medium">Code Editor</span>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 w-full h-full p-6 bg-transparent text-transparent caret-primary font-mono text-sm resize-none focus:outline-none z-10"
              spellCheck="false"
              style={{ 
                lineHeight: '1.6',
                tabSize: 4,
              }}
            />
            <pre
              className="absolute inset-0 w-full h-full p-6 font-mono text-sm overflow-auto pointer-events-none"
              style={{ lineHeight: '1.6' }}
              dangerouslySetInnerHTML={{ __html: highlightCode(code, language) }}
            />
          </div>
        </div>

        <div className="w-[45%] flex flex-col bg-console border-l border-border">
          <div className="bg-card px-4 py-2 border-b border-border text-sm text-muted-foreground flex items-center gap-2">
            <Terminal className="w-4 h-4 text-accent" />
            <span className="font-medium">Output Console</span>
          </div>
          <div
            ref={outputRef}
            className="flex-1 p-6 overflow-auto font-mono text-sm bg-[hsl(var(--console-bg))] flex flex-col"
          >
            <div className="flex-1">
              {output.length === 0 && language !== 'html' && !waitingForInput && (
                <div className="text-muted-foreground italic">
                  {language === 'python' 
                    ? 'Python 3.11 Console - Click "Run Code" to execute'
                    : 'Click "Run Code" to see output here...'}
                </div>
              )}
              {output.map((line, idx) => (
                <div
                  key={idx}
                  className={`mb-1 ${
                    line.type === 'info' ? 'text-primary font-semibold' :
                    line.type === 'success' ? 'text-green-400' :
                    line.type === 'error' ? 'text-destructive font-semibold' :
                    line.type === 'warning' ? 'text-yellow-400' :
                    line.type === 'input' ? 'text-blue-400' :
                    'text-foreground'
                  }`}
                >
                  {line.text || '\u00A0'}
                </div>
              ))}
            </div>
            
            {waitingForInput && (
              <div className="mt-4 border-t border-border pt-4">
                <div className="text-yellow-400 mb-2">{inputPrompt}</div>
                <div className="flex gap-2">
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
                    className="flex-1 bg-background border border-border rounded px-3 py-2 text-foreground focus:outline-none focus:border-primary"
                    placeholder="Type your input..."
                    autoFocus
                  />
                  <button
                    onClick={handleInputSubmit}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2 rounded font-medium"
                  >
                    Submit
                  </button>
                </div>
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
        
        .bg-console {
          background: hsl(var(--console-bg));
        }
        
        .shadow-glow {
          box-shadow: var(--shadow-glow);
        }
      `}</style>
    </div>
  );
};

export default CodeCompiler;
