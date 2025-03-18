
import React, { useState, useRef, useEffect } from 'react';
import { Message, processMessage } from '@/lib/chatbot';
import { cn } from '@/lib/utils';
import { Send, Info, ArrowDown, Key } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { ApiKeyInput } from './ApiKeyInput';

export const ChatUI: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'assistant',
      content: 'Hello! I\'m your GenSX powered assistant with MCP integration. How can I help you today?'
    }
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(localStorage.getItem('openai_api_key'));
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const [showScrollButton, setShowScrollButton] = useState(false);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleScroll = () => {
    if (messagesContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
      setShowScrollButton(scrollHeight - scrollTop - clientHeight > 100);
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (container) {
      container.addEventListener('scroll', handleScroll);
      return () => container.removeEventListener('scroll', handleScroll);
    }
  }, []);

  const handleApiKeySubmit = (key: string) => {
    setApiKey(key);
  };

  const handleRemoveApiKey = () => {
    localStorage.removeItem('openai_api_key');
    setApiKey(null);
    toast({
      title: 'API Key Removed',
      description: 'Your OpenAI API key has been removed from your browser.',
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!inputValue.trim()) return;
    
    const userMessage: Message = {
      role: 'user',
      content: inputValue.trim()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);
    
    try {
      const response = await processMessage(messages, userMessage.content, apiKey);
      
      const assistantMessage: Message = {
        role: 'assistant',
        content: response
      };
      
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error processing message:', error);
      toast({
        title: 'Error',
        description: 'Failed to process your message. Please check your API key and try again.',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const autoGrowTextArea = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 200)}px`;
  };

  if (!apiKey) {
    return <ApiKeyInput onApiKeySubmit={handleApiKeySubmit} />;
  }

  const messageElements = messages.map((message, index) => (
    <div
      key={index}
      className={cn(
        "py-3 px-4 rounded-2xl max-w-[85%] mb-4 animate-slide-up",
        message.role === 'assistant' 
          ? "bg-secondary/70 text-secondary-foreground mr-auto chat-message-in" 
          : "bg-primary text-primary-foreground ml-auto chat-message-out"
      )}
    >
      <p className="text-sm whitespace-pre-wrap">{message.content}</p>
    </div>
  ));

  return (
    <div className="flex flex-col h-full">
      {/* Chat messages container */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4" 
        onScroll={handleScroll}
      >
        <div className="flex flex-col">
          {messageElements}
          <div ref={messagesEndRef} />
        </div>

        {showScrollButton && (
          <button
            onClick={scrollToBottom}
            className="fixed bottom-24 right-8 p-2 rounded-full bg-primary/90 text-white shadow-lg hover:bg-primary transition-all animate-fade-in"
            aria-label="Scroll to bottom"
          >
            <ArrowDown size={20} />
          </button>
        )}
      </div>

      {/* Typing indicator while loading */}
      {isLoading && (
        <div className="px-4 pb-2">
          <div className="flex items-center space-x-2">
            <div className="flex space-x-1">
              <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: '300ms' }}></div>
              <div className="w-2 h-2 rounded-full bg-primary/50 animate-pulse" style={{ animationDelay: '600ms' }}></div>
            </div>
            <span className="text-xs text-muted-foreground">Assistant is typing...</span>
          </div>
        </div>
      )}

      {/* Input form */}
      <form onSubmit={handleSubmit} className="p-4 border-t border-border/50 glass-panel">
        <div className="relative">
          <textarea
            ref={inputRef}
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              autoGrowTextArea(e);
            }}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="w-full pl-4 pr-12 py-3 text-sm rounded-xl border-border/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 resize-none glass-input"
            rows={1}
            style={{ maxHeight: '200px', overflow: 'auto' }}
            disabled={isLoading}
          />
          <button
            type="submit"
            className={cn(
              "absolute right-2 bottom-3 p-2 rounded-lg transition-all",
              inputValue.trim()
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-muted text-muted-foreground cursor-not-allowed"
            )}
            disabled={!inputValue.trim() || isLoading}
          >
            <Send size={16} className="transition-transform group-hover:translate-x-1" />
          </button>
        </div>

        <div className="flex justify-between mt-2">
          <button
            type="button"
            onClick={() => toast({
              title: "About this chatbot",
              description: "This is a GenSX chatbot with MCP integration, designed to help you with various tasks by connecting to different service providers.",
            })}
            className="flex items-center text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            <Info size={12} className="mr-1" />
            About this chatbot
          </button>
          
          <button
            type="button"
            onClick={handleRemoveApiKey}
            className="flex items-center text-xs text-muted-foreground hover:text-destructive transition-colors"
          >
            <Key size={12} className="mr-1" />
            Remove API key
          </button>
        </div>
      </form>
    </div>
  );
};
