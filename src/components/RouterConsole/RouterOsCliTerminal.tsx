import React, { useState, useRef, useEffect } from 'react';
import { NetworkDevice, NetworkProject } from '../../types/network';
import { RouterOsDeviceConfig } from '../../types/routerOs';
import { RouterOsCliEngine } from '../../services/routerOsCliEngine';
import { RouterOsConfigService, MutationResult } from '../../services/routerOsConfigService';
import {
  Terminal as TerminalIcon,
  Trash2,
  Download,
  HelpCircle,
  Copy,
  Check,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

interface RouterOsCliTerminalProps {
  device: NetworkDevice;
  project: NetworkProject;
  mutateConfig: (
    actionName: string,
    mutationFn: (dev: NetworkDevice, cfg: RouterOsDeviceConfig) => MutationResult
  ) => MutationResult;
}

interface TerminalLine {
  id: string;
  type: 'prompt' | 'output' | 'error' | 'banner' | 'system';
  content: string;
  timestamp: string;
}

export const RouterOsCliTerminal: React.FC<RouterOsCliTerminalProps> = ({
  device,
  project,
  mutateConfig,
}) => {
  const config = RouterOsConfigService.ensureConfig(device);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [commandInput, setCommandInput] = useState<string>('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [copied, setCopied] = useState<boolean>(false);
  const [completions, setCompletions] = useState<string[]>([]);

  const inputRef = useRef<HTMLInputElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  // Generate initial ASCII banner
  const [lines, setLines] = useState<TerminalLine[]>(() => {
    const isV7 = device.routerOsVersion === 'v7';
    const ver = isV7 ? '7.15.2 (stable)' : '6.49.13 (long-term)';
    const banner = `  MikroTik RouterOS ${ver} (c) 1999-2024       https://mikrotik.com/
  Identity: ${device.name}
  Hardware: ${device.modelName} [${device.category.toUpperCase()}]
  Terminal: Simulated RouterOS Interactive Console (type 'help' or '?' for reference)
`;
    return [
      {
        id: 'banner-1',
        type: 'banner',
        content: banner,
        timestamp: new Date().toLocaleTimeString(),
      },
    ];
  });

  // Auto-scroll to bottom on line changes
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [lines]);

  // Keep input focused
  const handleTerminalClick = () => {
    inputRef.current?.focus();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // 1. Enter: execute command
    if (e.key === 'Enter') {
      e.preventDefault();
      const raw = commandInput.trim();
      const promptStr = RouterOsCliEngine.getPrompt(config.identity.name, currentPath);

      if (!raw) {
        setLines((prev) => [
          ...prev,
          {
            id: `line-${Date.now()}-${Math.random()}`,
            type: 'prompt',
            content: promptStr,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
        return;
      }

      // Add to command history
      setHistory((prev) => [...prev, raw]);
      setHistoryIndex(-1);

      // Execute command
      const result = RouterOsCliEngine.execute(
        raw,
        currentPath,
        device,
        project,
        mutateConfig
      );

      setCurrentPath(result.nextPath);
      setCommandInput('');
      setCompletions([]);

      if (result.output === '__CLEAR__') {
        setLines([]);
        return;
      }

      setLines((prev) => {
        const newEntries: TerminalLine[] = [
          {
            id: `cmd-${Date.now()}-p`,
            type: 'prompt',
            content: `${promptStr}${raw}`,
            timestamp: new Date().toLocaleTimeString(),
          },
        ];

        if (result.output) {
          newEntries.push({
            id: `cmd-${Date.now()}-out`,
            type: result.error ? 'error' : 'output',
            content: result.output,
            timestamp: new Date().toLocaleTimeString(),
          });
        }

        return [...prev, ...newEntries];
      });
      return;
    }

    // 2. Up Arrow: navigate history backwards
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length === 0) return;
      const nextIdx = historyIndex === -1 ? history.length - 1 : Math.max(0, historyIndex - 1);
      setHistoryIndex(nextIdx);
      setCommandInput(history[nextIdx] || '');
      return;
    }

    // 3. Down Arrow: navigate history forwards
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (history.length === 0 || historyIndex === -1) return;
      const nextIdx = historyIndex + 1;
      if (nextIdx >= history.length) {
        setHistoryIndex(-1);
        setCommandInput('');
      } else {
        setHistoryIndex(nextIdx);
        setCommandInput(history[nextIdx] || '');
      }
      return;
    }

    // 4. Tab: auto-completion
    if (e.key === 'Tab') {
      e.preventDefault();
      const suggestions = RouterOsCliEngine.getCompletions(commandInput, currentPath, device);
      if (suggestions.length === 1) {
        const words = commandInput.trim().split(/\s+/);
        if (words.length <= 1) {
          setCommandInput(suggestions[0] + ' ');
        } else {
          words[words.length - 1] = suggestions[0];
          setCommandInput(words.join(' ') + ' ');
        }
        setCompletions([]);
      } else if (suggestions.length > 1) {
        setCompletions(suggestions);
      }
    }
  };

  const clearScreen = () => {
    setLines([]);
  };

  const copyTerminalOutput = () => {
    const text = lines.map((l) => l.content).join('\n');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const insertQuickCommand = (cmd: string) => {
    setCommandInput(cmd);
    inputRef.current?.focus();
  };

  return (
    <div
      onClick={handleTerminalClick}
      className="flex flex-col h-full bg-slate-950 text-slate-200 font-mono text-xs select-text"
    >
      {/* Terminal Command Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800 text-[11px] font-sans shrink-0">
        <div className="flex items-center gap-2">
          <TerminalIcon className="w-4 h-4 text-cyan-400" />
          <span className="font-bold text-slate-100 font-mono">
            {device.name} [/{currentPath.join(' ')}]
          </span>
          <span className="px-1.5 py-0.2 rounded text-[9.5px] bg-slate-800 text-slate-400 font-mono">
            RouterOS {device.routerOsVersion}
          </span>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            onClick={() => insertQuickCommand('print')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10.5px] font-mono transition-colors"
          >
            print
          </button>
          <button
            onClick={() => insertQuickCommand('/ip address print')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[10.5px] font-mono transition-colors"
          >
            /ip address pr
          </button>
          <button
            onClick={() => insertQuickCommand('/interface print')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 text-[10.5px] font-mono transition-colors"
          >
            /interface pr
          </button>
          <button
            onClick={() => insertQuickCommand('export')}
            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-amber-300 text-[10.5px] font-mono transition-colors"
          >
            export
          </button>
          <button
            onClick={copyTerminalOutput}
            title="Copy Terminal Text"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={clearScreen}
            title="Clear Terminal"
            className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-rose-400 transition-colors"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Terminal Output Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-1 font-mono text-[12px] leading-relaxed cursor-text">
        {lines.map((line) => {
          if (line.type === 'banner') {
            return (
              <pre key={line.id} className="text-cyan-400 font-bold whitespace-pre-wrap select-text mb-2">
                {line.content}
              </pre>
            );
          }
          if (line.type === 'prompt') {
            return (
              <div key={line.id} className="text-emerald-400 font-bold select-text">
                {line.content}
              </div>
            );
          }
          if (line.type === 'error') {
            return (
              <pre key={line.id} className="text-rose-400 whitespace-pre-wrap select-text pl-2 border-l border-rose-500/40">
                {line.content}
              </pre>
            );
          }
          return (
            <pre key={line.id} className="text-slate-300 whitespace-pre-wrap select-text">
              {line.content}
            </pre>
          );
        })}

        {/* Tab Completion Suggestions */}
        {completions.length > 0 && (
          <div className="p-2 my-1 rounded bg-slate-900 border border-cyan-800/60 text-cyan-300 flex flex-wrap gap-2 text-[11px]">
            <span className="text-slate-500 font-sans">Suggestions:</span>
            {completions.map((comp) => (
              <button
                key={comp}
                onClick={() => {
                  setCommandInput((prev) => {
                    const words = prev.trim().split(/\s+/);
                    words[words.length - 1] = comp;
                    return words.join(' ') + ' ';
                  });
                  setCompletions([]);
                  inputRef.current?.focus();
                }}
                className="px-1.5 py-0.5 rounded bg-slate-800 hover:bg-cyan-900 text-cyan-200 transition-colors"
              >
                {comp}
              </button>
            ))}
          </div>
        )}

        {/* Active Command Input Line */}
        <div className="flex items-center gap-1 text-emerald-400 font-bold pt-1">
          <span className="shrink-0 select-none">
            {RouterOsCliEngine.getPrompt(config.identity.name, currentPath)}
          </span>
          <input
            ref={inputRef}
            type="text"
            value={commandInput}
            onChange={(e) => setCommandInput(e.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            spellCheck={false}
            autoComplete="off"
            className="flex-1 bg-transparent border-none outline-none text-slate-100 font-mono text-[12px] caret-cyan-400 focus:ring-0 p-0"
          />
        </div>

        <div ref={bottomRef} />
      </div>

      {/* Terminal Footer Helper */}
      <div className="px-3 py-1 bg-slate-900/90 border-t border-slate-800 text-[10px] text-slate-500 flex items-center justify-between font-sans">
        <div className="flex items-center gap-3">
          <span><kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">Tab</kbd> Autocomplete</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">↑/↓</kbd> History</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">..</kbd> Up context</span>
          <span><kbd className="px-1 py-0.5 rounded bg-slate-800 text-slate-300">/</kbd> Root</span>
        </div>
        <div className="text-cyan-400 font-mono">Simulated RouterOS Engine</div>
      </div>
    </div>
  );
};
