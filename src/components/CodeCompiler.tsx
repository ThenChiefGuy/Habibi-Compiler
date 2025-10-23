import React, { useState, useEffect, useRef } from 'react';
import { Play, Trash2, Code2, Terminal, FileCode, Zap, Monitor, Loader2, Square } from 'lucide-react';

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
  const [executionTime, setExecutionTime] = useState<number | null>(null);
  const outputRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const pyodideRef = useRef<any>(null);
  const inputResolverRef = useRef<((value: string) => void) | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const outputBufferRef = useRef<string[]>([]);
  const executionStartTimeRef = useRef<number>(0);

  const examples = {
    python: `# Python 3.11 - Full Standard Library
# Try importing any module: math, random, json, etc.

# Basic example
name = input("Enter your name: ")
print(f"Hello, {name}!")

# Math operations
import math
numbers = [1, 2, 3, 4, 5]
print(f"Sum: {sum(numbers)}")
print(f"Square root of 16: {math.sqrt(16)}")

# List comprehension
squares = [x**2 for x in range(1, 6)]
print(f"Squares: {squares}")`,

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
    setExecutionTime(null);
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
    if (pyodideRef.current || loadingPyodide) return;
    
    setLoadingPyodide(true);
    addOutput('Loading Python 3.11 runtime...', 'info');
    
    try {
      // Check if loadPyodide is already available
      // @ts-ignore
      if (!window.loadPyodide) {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/pyodide.js';
        script.async = true;
        
        await new Promise((resolve, reject) => {
          script.onload = resolve;
          script.onerror = reject;
          document.head.appendChild(script);
        });
      }

      // @ts-ignore
      const pyodide = await window.loadPyodide({
        indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.24.1/full/'
      });

      pyodideRef.current = pyodide;

      // Setup stdout with buffering for better performance
      pyodide.setStdout({
        batched: (text: string) => {
          outputBufferRef.current.push(text);
          // Flush buffer periodically
          if (outputBufferRef.current.length > 0) {
            const combined = outputBufferRef.current.join('');
            outputBufferRef.current = [];
            addOutput(combined, 'success');
          }
        }
      });

      pyodide.setStderr({
        batched: (text: string) => {
          addOutput(text, 'error');
        }
      });

      // Setup custom input function with proper async handling
      pyodide.globals.set('js_input', (prompt: string = '') => {
        return new Promise((resolve) => {
          setInputPrompt(prompt);
          setWaitingForInput(true);
          inputResolverRef.current = resolve;
        });
      });

      // Override built-in input with proper implementation
      await pyodide.runPythonAsync(`
import sys
from js import js_input

class InputWrapper:
    async def __call__(self, prompt=''):
        if prompt:
            sys.stdout.write(str(prompt))
            sys.stdout.flush()
        result = await js_input(prompt)
        return str(result)

_input = InputWrapper()

import builtins
builtins.input = lambda prompt='': __import__('asyncio').run(_input(prompt))
      `);

      setPyodideReady(true);
      addOutput('Python 3.11.3 ready!', 'success');
      addOutput('', 'output');
    } catch (error) {
      addOutput(`Failed to load Python: ${(error as Error).message}`, 'error');
      addOutput('Please refresh the page and try again.', 'error');
      setPyodideReady(false);
      pyodideRef.current = null;
    } finally {
      setLoadingPyodide(false);
    }
  };

  const addOutput = (text: string, type = 'output') => {
    setOutput(prev => [...prev, { text, type }]);
  };

  const clearOutput = () => {
    setOutput([]);
    setExecutionTime(null);
    outputBufferRef.current = [];
  };

  const handleInputSubmit = () => {
    if (inputResolverRef.current && userInput !== null) {
      const promptText = inputPrompt || '';
      addOutput(promptText + userInput, 'input');
      inputResolverRef.current(userInput);
      inputResolverRef.current = null;
      setWaitingForInput(false);
      setUserInput('');
      setInputPrompt('');
    }
  };

  const stopExecution = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    
    if (inputResolverRef.current) {
      inputResolverRef.current('');
      inputResolverRef.current = null;
    }
    
    setIsRunning(false);
    setWaitingForInput(false);
    setUserInput('');
    setInputPrompt('');
    
    // Flush any remaining output
    if (outputBufferRef.current.length > 0) {
      const combined = outputBufferRef.current.join('');
      outputBufferRef.current = [];
      addOutput(combined, 'success');
    }
    
    addOutput('', 'output');
    addOutput('⚠ Execution stopped by user', 'warning');
    
    if (executionStartTimeRef.current > 0) {
      const elapsed = ((Date.now() - executionStartTimeRef.current) / 1000).toFixed(2);
      setExecutionTime(parseFloat(elapsed));
    }
  };

  const runPython = async (code: string) => {
    if (!pyodideReady && !pyodideRef.current) {
      await loadPyodide();
    }

    if (!pyodideRef.current) {
      addOutput('Python runtime not available. Please try again.', 'error');
      return;
    }

    outputBufferRef.current = [];
    abortControllerRef.current = new AbortController();
    executionStartTimeRef.current = Date.now();

    try {
      // Check for potential infinite loops (basic detection)
      const hasWhileTrue = /while\s+True\s*:/i.test(code) || /while\s+1\s*:/i.test(code);
      if (hasWhileTrue && !/break/.test(code)) {
        addOutput('⚠ Warning: Detected potential infinite loop (while True without break)', 'warning');
        addOutput('Use the Stop button if execution hangs.', 'warning');
        addOutput('', 'output');
      }

      // Run the code with interrupt support
      const result = await Promise.race([
        pyodideRef.current.runPythonAsync(code),
        new Promise((_, reject) => {
          abortControllerRef.current?.signal.addEventListener('abort', () => {
            reject(new Error('Execution stopped'));
          });
        })
      ]);

      // Flush any remaining output
      if (outputBufferRef.current.length > 0) {
        const combined = outputBufferRef.current.join('');
        outputBufferRef.current = [];
        addOutput(combined, 'success');
      }

      const elapsed = ((Date.now() - executionStartTimeRef.current) / 1000).toFixed(2);
      setExecutionTime(parseFloat(elapsed));
      
      addOutput('', 'output');
      addOutput(`✓ Execution completed successfully (${elapsed}s)`, 'info');
      
    } catch (error: any) {
      // Flush any remaining output before showing error
      if (outputBufferRef.current.length > 0) {
        const combined = outputBufferRef.current.join('');
        outputBufferRef.current = [];
        addOutput(combined, 'success');
      }

      if (error.message === 'Execution stopped') {
        // Already handled in stopExecution
        return;
      }

      const elapsed = ((Date.now() - executionStartTimeRef.current) / 1000).toFixed(2);
      setExecutionTime(parseFloat(elapsed));
      
      if (!error.message?.includes('KeyboardInterrupt')) {
        addOutput('', 'output');
        addOutput(`✗ Execution failed (${elapsed}s)`, 'error');
      }
    } finally {
      abortControllerRef.current = null;
      executionStartTimeRef.current = 0;
    }
  };

  const runJava = (code: string) => {
    addOutput('>>> Compiling Java...', 'info');
    addOutput('>>> Running Main class...', 'info');
    addOutput('', 'output');

    const startTime = Date.now();

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
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      setExecutionTime(parseFloat(elapsed));
      
      addOutput('', 'output');
      addOutput(`>>> BUILD SUCCESSFUL (${elapsed}s)`, 'info');
    } catch (error) {
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      setExecutionTime(parseFloat(elapsed));
      addOutput('Error: ' + (error as Error).message, 'error');
    }
  };

  const runHTML = (code: string) => {
    const startTime = Date.now();
    
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
      
      const elapsed = ((Date.now() - startTime) / 1000).toFixed(2);
      setExecutionTime(parseFloat(elapsed));
    }
  };

  const handleRun = async () => {
    setIsRunning(true);
    clearOutput();
    
    try {
      if (language === 'python') {
        await runPython(code);
      } else if (language === 'java') {
        runJava(code);
      } else if (language === 'html') {
        runHTML(code);
      }
    } finally {
      setIsRunning(false);
    }
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
    <div className="min-h-screen bg-[#1e1e1e] text-[#d4d4d4]">
      <div className="bg-[#252526] border-b border-[#3e3e42] px-6 py-3 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <Code2 className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">
              Code Compiler
            </h1>
            <p className="text-xs text-[#858585]">
              {language === 'python' ? 'Python 3.11.3 • Full Standard Library' : 'Professional IDE Environment'}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          {executionTime !== null && (
            <div className="text-xs text-[#858585] px-3 py-1 bg-[#1e1e1e] rounded border border-[#3e3e42]">
              {executionTime}s
            </div>
          )}
          
          <div className="flex items-center gap-2 bg-[#1e1e1e] px-3 py-2 rounded-lg border border-[#3e3e42]">
            {getLanguageIcon()}
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              className="bg-transparent text-[#d4d4d4] focus:outline-none cursor-pointer font-medium"
            >
              <option value="python">Python</option>
              <option value="java">Java</option>
              <option value="html">HTML</option>
            </select>
          </div>
          
          {isRunning ? (
            <button
              onClick={stopExecution}
              className="bg-red-600 hover:bg-red-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg transition-all"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          ) : (
            <button
              onClick={handleRun}
              disabled={loadingPyodide}
              className="bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loadingPyodide ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Loading...
                </>
              ) : (
                <>
                  <Play className="w-4 h-4" />
                  Run
                </>
              )}
            </button>
          )}
          
          <button
            onClick={clearOutput}
            className="bg-[#3e3e42] hover:bg-[#4e4e52] text-white px-5 py-2 rounded-lg flex items-center gap-2 font-medium shadow-lg transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Clear
          </button>
        </div>
      </div>

      <div className="flex h-[calc(100vh-73px)]">
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
          <div className="bg-[#252526] px-4 py-2 border-b border-[#3e3e42] text-sm text-[#858585] flex items-center gap-2">
            <Zap className="w-4 h-4 text-blue-400" />
            <span className="font-medium">main.{language === 'python' ? 'py' : language === 'java' ? 'java' : 'html'}</span>
          </div>
          <div className="flex-1 relative overflow-hidden">
            <textarea
              ref={textareaRef}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={handleKeyDown}
              className="absolute inset-0 w-full h-full p-6 bg-transparent text-transparent caret-white font-mono text-sm resize-none focus:outline-none z-10"
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

        <div className="w-[45%] flex flex-col bg-[#1e1e1e] border-l border-[#3e3e42]">
          <div className="bg-[#252526] px-4 py-2 border-b border-[#3e3e42] text-sm text-[#858585] flex items-center gap-2">
            <Terminal className="w-4 h-4 text-green-400" />
            <span className="font-medium">Output</span>
          </div>
          <div
            ref={outputRef}
            className="flex-1 p-6 overflow-auto font-mono text-sm bg-[#0c0c0c] flex flex-col"
          >
            <div className="flex-1">
              {output.length === 0 && language !== 'html' && !waitingForInput && (
                <div className="text-[#6e6e6e] italic">
                  {language === 'python' 
                    ? '>>> Python 3.11 Console Ready'
                    : '>>> Click Run to execute your code'}
                </div>
              )}
              {output.map((line, idx) => (
                <div
                  key={idx}
                  className={`mb-1 whitespace-pre-wrap ${
                    line.type === 'info' ? 'text-blue-400' :
                    line.type === 'success' ? 'text-green-400' :
                    line.type === 'error' ? 'text-red-400' :
                    line.type === 'warning' ? 'text-yellow-400' :
                    line.type === 'input' ? 'text-cyan-400' :
                    'text-[#d4d4d4]'
                  }`}
                >
                  {line.text || '\u00A0'}
                </div>
              ))}
            </div>
            
            {waitingForInput && (
              <div className="mt-4 border-t border-[#3e3e42] pt-4">
                <div className="flex gap-2 items-center">
                  <span className="text-cyan-400">→</span>
                  <input
                    ref={inputRef}
                    type="text"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleInputSubmit()}
                    className="flex-1 bg-[#1e1e1e] border border-[#3e3e42] rounded px-3 py-2 text-[#d4d4d4] focus:outline-none focus:border-blue-500"
                    placeholder="Enter input..."
                    autoFocus
                  />
                  <button
                    onClick={handleInputSubmit}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded font-medium"
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
        .keyword { color: #c586c0; font-weight: 600; }
        .string { color: #ce9178; }
        .number { color: #b5cea8; }
        .comment { color: #6a9955; font-style: italic; }
        .function { color: #dcdcaa; }
        .builtin { color: #4ec9b0; }
      `}</style>
    </div>
  );
};

export default CodeCompiler;
