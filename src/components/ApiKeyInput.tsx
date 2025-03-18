
import React, { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

interface ApiKeyInputProps {
  onApiKeySubmit: (apiKey: string) => void;
}

export const ApiKeyInput: React.FC<ApiKeyInputProps> = ({ onApiKeySubmit }) => {
  const [apiKey, setApiKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!apiKey.trim()) {
      toast({
        title: "Error",
        description: "Please enter your OpenAI API key",
        variant: "destructive"
      });
      return;
    }

    if (!apiKey.startsWith("sk-")) {
      toast({
        title: "Warning",
        description: "This doesn't look like a valid OpenAI API key. It should start with 'sk-'",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    // Store in localStorage
    localStorage.setItem('openai_api_key', apiKey);
    
    // Notify parent component
    onApiKeySubmit(apiKey);
    
    setIsLoading(false);
    
    toast({
      title: "Success",
      description: "API key saved successfully",
    });
  };

  return (
    <div className="flex flex-col items-center justify-center p-6 max-w-md mx-auto mt-10 space-y-6 bg-card rounded-xl shadow-sm border border-border/20">
      <div className="text-center space-y-2 mb-4">
        <h2 className="text-2xl font-bold">Enter your OpenAI API Key</h2>
        <p className="text-muted-foreground text-sm">
          Your API key is stored locally in your browser and never sent to our servers.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 w-full">
        <div>
          <Input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="sk-..."
            className="w-full"
            autoComplete="off"
          />
          <p className="text-xs text-muted-foreground mt-1">
            Get your API key from{' '}
            <a 
              href="https://platform.openai.com/api-keys" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              OpenAI's dashboard
            </a>
          </p>
        </div>

        <Button 
          type="submit" 
          className="w-full" 
          disabled={isLoading}
        >
          {isLoading ? 'Saving...' : 'Save API Key'}
        </Button>
      </form>
    </div>
  );
};
