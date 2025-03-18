
import React from 'react';
import { Bot } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="border-b border-border/50 glass-panel py-4 px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <div className="bg-primary/10 p-2 rounded-lg mr-3">
            <Bot size={24} className="text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-medium">GenSX Chatbot</h1>
            <p className="text-xs text-muted-foreground">with MCP Integration</p>
          </div>
        </div>
      </div>
    </header>
  );
};
