
import React from 'react';
import { ChatUI } from '@/components/ChatUI';
import { Header } from '@/components/Header';

const Index = () => {
  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-br from-background to-secondary/20">
      <div className="flex justify-center w-full">
        <div className="w-full max-w-3xl min-h-screen flex flex-col shadow-sm">
          <Header />
          <div className="flex-1 flex flex-col">
            <ChatUI />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Index;
