import { ChatMessage, DetectedObject } from '../types';
import { Icons } from '../utils/icons';
import { ApiService } from '../services/apiService';

export class ChatAssistant {
  private container: HTMLElement;
  private messages: ChatMessage[] = [];
  private isLoading: boolean = false;
  private imageBase64: string | null = null;
  private detections: DetectedObject[] = [];
  private sceneSummary: string = '';

  constructor(container: HTMLElement) {
    this.container = container;
  }

  public setContext(imageBase64: string | null, detections: DetectedObject[], sceneSummary: string) {
    this.imageBase64 = imageBase64;
    this.detections = detections;
    this.sceneSummary = sceneSummary;
  }

  public getMessages(): ChatMessage[] {
    return this.messages;
  }

  public addMessage(role: 'user' | 'assistant', content: string) {
    this.messages.push({
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      role,
      content,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    });
    this.render();
    this.scrollToBottom();
  }

  public clearChat() {
    this.messages = [];
    this.render();
  }

  public async askQuestion(questionText: string) {
    if (!questionText.trim() || this.isLoading) return;

    this.addMessage('user', questionText.trim());
    this.isLoading = true;
    this.render();
    this.scrollToBottom();

    try {
      const response = await ApiService.askVisualAssistant(
        questionText.trim(),
        this.imageBase64 || undefined,
        this.messages,
        this.detections,
        this.sceneSummary
      );

      this.addMessage('assistant', response.answer);
    } catch (error: any) {
      this.addMessage(
        'assistant',
        `⚠️ Error processing visual inquiry: ${error.message || 'Please check your connection or API status.'}`
      );
    } finally {
      this.isLoading = false;
      this.render();
      this.scrollToBottom();
    }
  }

  private scrollToBottom() {
    setTimeout(() => {
      const scrollArea = document.getElementById('chat-scroll-area');
      if (scrollArea) {
        scrollArea.scrollTop = scrollArea.scrollHeight;
      }
    }, 50);
  }

  public render() {
    const defaultChips = [
      'What objects are present in this image?',
      'How many people or vehicles are visible?',
      'Which objects are closest to the camera?',
      'What is happening in the background?',
      'Describe the colors and spatial arrangement',
    ];

    this.container.innerHTML = `
      <div class="flex flex-col h-full bg-cyber-900/90 border-l border-cyan-500/20 backdrop-blur-md">
        <!-- Header -->
        <div class="p-3.5 border-b border-cyan-500/20 bg-cyber-950/60 flex items-center justify-between">
          <div class="flex items-center gap-2">
            <span class="w-2.5 h-2.5 rounded-full bg-cyan-400 glow-cyan"></span>
            <div>
              <h4 class="text-xs font-mono font-bold uppercase tracking-wider text-white">VISUAL AGENT CONVERSATION</h4>
              <p class="text-[10px] font-mono text-cyan-400">GEMINI-3.8-FLASH • CONTEXT GROUNDED</p>
            </div>
          </div>
          <button id="clear-chat-btn" class="p-1.5 rounded-lg bg-slate-800/80 hover:bg-red-500/20 hover:text-red-400 text-slate-400 border border-slate-700 transition" title="Clear Conversation">
            ${Icons.trash}
          </button>
        </div>

        <!-- Chat messages container -->
        <div id="chat-scroll-area" class="flex-1 overflow-y-auto p-3.5 space-y-3">
          ${this.messages.length === 0 ? `
            <div class="h-full flex flex-col items-center justify-center text-center p-4 text-slate-500">
              <div class="w-12 h-12 rounded-2xl glass-panel-subtle flex items-center justify-center text-cyan-400 mb-3 glow-cyan">
                ${Icons.chat}
              </div>
              <p class="text-xs font-mono font-semibold text-slate-300 uppercase tracking-wide mb-1">IMAGE INTELLIGENCE AGENT</p>
              <p class="text-[11px] text-slate-500 max-w-[240px] leading-relaxed mb-4">
                Ask any question regarding visible objects, counts, colors, spatial relationships, or fine details.
              </p>

              <!-- Quick query chips -->
              <div class="w-full space-y-1.5 text-left">
                <span class="text-[10px] font-mono text-slate-400 block px-1">SUGGESTED INQUIRIES:</span>
                ${defaultChips.map(chip => `
                  <button class="chat-chip w-full text-left px-2.5 py-1.5 rounded-lg bg-cyber-950 border border-slate-800 text-[11px] text-slate-300 hover:border-cyan-500/40 hover:text-cyan-300 transition truncate" data-prompt="${chip}">
                    💬 ${chip}
                  </button>
                `).join('')}
              </div>
            </div>
          ` : this.messages.map(m => {
            const isUser = m.role === 'user';
            return `
              <div class="flex flex-col ${isUser ? 'items-end' : 'items-start'}">
                <div class="flex items-center gap-1.5 mb-1 px-1">
                  <span class="text-[10px] font-mono ${isUser ? 'text-cyan-400' : 'text-orange-400'} font-semibold">
                    ${isUser ? 'OPERATOR' : 'VISUAL ALGO AI'}
                  </span>
                  <span class="text-[9px] font-mono text-slate-500">${m.timestamp}</span>
                </div>
                <div class="max-w-[90%] p-3 rounded-2xl text-xs leading-relaxed ${isUser ? 'bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-tr-none' : 'glass-panel border border-cyan-500/20 text-slate-200 rounded-tl-none font-sans'}">
                  ${this.formatContent(m.content)}
                </div>
              </div>
            `;
          }).join('')}

          ${this.isLoading ? `
            <div class="flex flex-col items-start">
              <div class="flex items-center gap-1.5 mb-1 px-1">
                <span class="text-[10px] font-mono text-orange-400 font-semibold">VISUAL ALGO AI</span>
                <span class="text-[9px] font-mono text-slate-500">ANALYZING...</span>
              </div>
              <div class="glass-panel border border-cyan-500/30 p-3 rounded-2xl rounded-tl-none flex items-center gap-2">
                <span class="w-2 h-2 rounded-full bg-cyan-400 animate-ping"></span>
                <span class="text-xs font-mono text-cyan-300">Evaluating telemetry & scene context...</span>
              </div>
            </div>
          ` : ''}
        </div>

        <!-- Chat input bar -->
        <div class="p-3 border-t border-cyan-500/20 bg-cyber-950/80">
          <form id="chat-form" class="flex items-center gap-2">
            <input type="text" id="chat-input" placeholder="Ask about this image..." class="flex-1 px-3 py-2 rounded-xl bg-cyber-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none font-mono" autocomplete="off" />
            <button type="submit" class="px-3 py-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 text-black font-semibold text-xs hover:opacity-90 transition glow-cyan">
              ${Icons.send}
            </button>
          </form>
        </div>
      </div>
    `;

    this.bindEvents();
  }

  private formatContent(text: string): string {
    // Escape HTML then convert markdown bold, bullets, and obj IDs
    let safe = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Bold
    safe = safe.replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>');
    
    // Object IDs highlight
    safe = safe.replace(/\b(OBJ_\d{3})\b/g, '<span class="px-1.5 py-0.5 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[11px] font-bold border border-cyan-500/40">$1</span>');

    // Bullets
    safe = safe.replace(/^[•*-]\s+(.+)$/gm, '<li class="ml-4 list-disc">$1</li>');

    // Newlines
    safe = safe.replace(/\n\n/g, '<br/><br/>').replace(/\n/g, '<br/>');

    return safe;
  }

  private bindEvents() {
    const form = document.getElementById('chat-form') as HTMLFormElement;
    const input = document.getElementById('chat-input') as HTMLInputElement;

    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      if (input && input.value.trim()) {
        const q = input.value.trim();
        input.value = '';
        this.askQuestion(q);
      }
    });

    this.container.querySelectorAll('.chat-chip').forEach(btn => {
      btn.addEventListener('click', () => {
        const prompt = btn.getAttribute('data-prompt');
        if (prompt) this.askQuestion(prompt);
      });
    });

    document.getElementById('clear-chat-btn')?.addEventListener('click', () => {
      this.clearChat();
    });
  }
}
