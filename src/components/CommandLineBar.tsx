import React, { useState, useRef } from 'react';
import { Search, Send, HelpCircle, Terminal, X } from 'lucide-react';

interface CommandLineBarProps {
  onExecuteCommand: (command: string) => void;
  onFilterCategory?: (filter: string) => void;
}

export const CommandLineBar: React.FC<CommandLineBarProps> = ({
  onExecuteCommand
}) => {
  const [inputVal, setInputVal] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);
  const [showHelp, setShowHelp] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cmd = inputVal.trim();
    if (!cmd) return;

    setHistory(prev => [cmd, ...prev]);
    setHistoryIndex(-1);
    setInputVal('');

    if (cmd.toLowerCase() === 'help' || cmd.toLowerCase() === '--help') {
      setShowHelp(prev => !prev);
      return;
    }

    onExecuteCommand(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (history.length > 0 && historyIndex < history.length - 1) {
        const nextIdx = historyIndex + 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex > 0) {
        const nextIdx = historyIndex - 1;
        setHistoryIndex(nextIdx);
        setInputVal(history[nextIdx]);
      } else if (historyIndex === 0) {
        setHistoryIndex(-1);
        setInputVal('');
      }
    }
  };

  const quickCommands = [
    { label: '👤 my profile', cmd: 'profile' },
    { label: '🎯 buy target', cmd: 'target NVDA 12500' },
    { label: '🌐 diversify', cmd: 'diversify' },
    { label: '📌 snapshot', cmd: 'snapshot' },
    { label: '⏳ +4h return', cmd: 'compare 4h' },
    { label: '🚨 filter attention', cmd: 'filter attention' },
    { label: '⚡ tech rally', cmd: 'sim tech-rally' }
  ];

  return (
    <div className="bg-[#E0E5EC] px-4 py-4 font-body shadow-neu-inset-sm">
      <div className="max-w-7xl mx-auto">
        <form onSubmit={handleSubmit} className="flex flex-wrap items-center gap-3">
          {/* Carved Deep Inset Well for Search Input */}
          <div className="flex-1 min-w-[260px] flex items-center gap-3 bg-[#E0E5EC] px-4 py-2.5 rounded-2xl shadow-neu-inset focus-within:shadow-neu-inset-deep transition-all duration-300">
            <span className="flex h-7 w-7 items-center justify-center rounded-xl bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset-sm shrink-0">
              <Search className="h-3.5 w-3.5" strokeWidth={2.2} />
            </span>
            <input
              id="terminal-cli-input"
              ref={inputRef}
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type command or ticker (e.g. 'snapshot', 'add PLTR', 'filter attention', 'compare 4h', 'help')..."
              className="w-full bg-transparent text-[#3D4852] font-body text-sm font-medium placeholder-[#A0AEC0] focus:outline-none"
              autoComplete="off"
              spellCheck="false"
            />
          </div>

          <button
            id="btn-cli-execute"
            type="submit"
            className="btn-neu-primary px-5 py-2.5 text-xs font-bold rounded-2xl flex items-center gap-2 hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
          >
            <Send className="h-3.5 w-3.5" strokeWidth={2} />
            <span>Run</span>
          </button>

          <button
            id="btn-cli-help"
            type="button"
            onClick={() => setShowHelp(prev => !prev)}
            className="btn-neu px-4 py-2.5 text-xs font-bold rounded-2xl flex items-center gap-2 text-[#3D4852] hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
            title="Command Guide"
          >
            <span className="flex h-5 w-5 items-center justify-center rounded-lg bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset-sm">
              <HelpCircle className="h-3 w-3" strokeWidth={2.2} />
            </span>
            <span>Guide</span>
          </button>
        </form>

        {/* Quick shortcut tactile chips */}
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <span className="font-display font-bold text-[#6B7280] uppercase tracking-wider text-[11px] mr-1">
            Quick Shortcuts:
          </span>
          {quickCommands.map((qc) => (
            <button
              key={qc.cmd}
              type="button"
              onClick={() => onExecuteCommand(qc.cmd)}
              className="btn-neu px-3.5 py-1.5 font-display text-xs font-bold rounded-full text-[#3D4852] hover:-translate-y-0.5 active:translate-y-0.5 transition-all duration-300"
            >
              {qc.label}
            </button>
          ))}
        </div>

        {/* Pop-out Command Guide in Neumorphic Extruded Panel */}
        {showHelp && (
          <div className="relative mt-4 bg-[#E0E5EC] rounded-[32px] shadow-neu-extrude p-6 transition-all duration-300">
            {/* Header */}
            <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#D1D9E6]">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-[#E0E5EC] text-[#6C63FF] shadow-neu-inset-sm">
                  <Terminal className="h-4 w-4" strokeWidth={2.2} />
                </span>
                <span className="font-display font-extrabold text-sm uppercase tracking-wider text-[#3D4852]">
                  COMMAND REFERENCE
                </span>
              </div>
              <button
                onClick={() => setShowHelp(false)}
                className="btn-neu px-3 py-1 text-xs font-bold rounded-full text-[#6B7280] hover:text-[#3D4852]"
              >
                Close ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 font-body text-xs">
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#6C63FF]">profile</code>
                <span className="text-[#6B7280]">Access trading profile, currency preferences & verified account</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#38B2AC]">target &lt;SYM&gt; &lt;₹&gt;</code>
                <span className="text-[#6B7280]">Set custom buy reminder in ₹ (e.g. <code className="font-mono">target NVDA 12500</code>)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#6C63FF]">snapshot</code>
                <span className="text-[#6B7280]">Anchor current market state as your new baseline reference</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#6C63FF]">compare &lt;1h|4h|24h&gt;</code>
                <span className="text-[#6B7280]">Simulate returning later to see what has changed</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#3D4852]">add &lt;SYMBOL&gt;</code>
                <span className="text-[#6B7280]">Add a new ticker to watchlist (e.g. <code className="font-mono">add PLTR</code>)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#3D4852]">remove &lt;SYMBOL&gt;</code>
                <span className="text-[#6B7280]">Drop ticker from watchlist</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#D97706]">threshold &lt;SYM&gt; &lt;%&gt;</code>
                <span className="text-[#6B7280]">Tune sensitivity threshold (e.g. <code className="font-mono">threshold NVDA 3.0</code>)</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#38B2AC]">filter &lt;all|attn|knowing&gt;</code>
                <span className="text-[#6B7280]">Filter cards by attention tier</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#6C63FF]">sim &lt;tech-rally|energy-dip&gt;</code>
                <span className="text-[#6B7280]">Trigger simulated macro sector impulses</span>
              </div>
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-[#E0E5EC] shadow-neu-inset-sm">
                <code className="font-mono font-bold bg-[#E0E5EC] px-2.5 py-1 rounded-xl shadow-neu-extrude-sm text-[#38B2AC]">sim resolve-events</code>
                <span className="text-[#6B7280]">Advance ongoing anomalies to RESOLVED state</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
