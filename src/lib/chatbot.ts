
import gensx from './gensx';
import { MCPConfig, createMCPContext } from './mcp';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChooseMCPServerProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpConfigs: MCPConfig[];
}

interface ChooseMCPServerOutput {
  serverName: string;
  reasoning: string;
}

interface ExecuteMCPCallProps {
  serverName: string;
  chatHistory: Message[];
  latestMessage: string;
  mcpConfigs: MCPConfig[];
}

interface FormatResponseProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpResult: string;
}

interface ChatbotProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpConfigs: MCPConfig[];
}

// Mock LLM call function for demo purposes
const mockLLMCall = async (prompt: string): Promise<string> => {
  console.log('LLM Prompt:', prompt);
  
  // Simulate different responses based on the prompt
  if (prompt.includes('choose MCP server')) {
    const randomServer = ['weather-mcp', 'search-mcp', 'calendar-mcp'][Math.floor(Math.random() * 3)];
    return JSON.stringify({
      serverName: randomServer,
      reasoning: `Selected ${randomServer} because it's the most relevant for this query.`
    });
  } else if (prompt.includes('execute MCP call')) {
    return `Result from MCP server: Here's the information you requested.`;
  } else {
    return `Based on the MCP server results, I can tell you that ${prompt.split(' ').slice(-5).join(' ')}`;
  }
};

// Component to choose the appropriate MCP server
export const ChooseMCPServer = gensx.Component<ChooseMCPServerProps, ChooseMCPServerOutput>(
  async ({ chatHistory, latestMessage, mcpConfigs }) => {
    const prompt = `
      Given the following chat history and latest message, choose the most appropriate MCP server to handle the request.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      Available MCP Servers:
      ${mcpConfigs.map(config => `${config.name}: ${config.description}`).join('\n')}
      
      Return a JSON object with:
      - serverName: the name of the chosen server
      - reasoning: brief explanation of why this server was chosen
    `;
    
    // In a real implementation, this would call GPT-4o or similar
    const response = await mockLLMCall(prompt);
    
    try {
      return JSON.parse(response);
    } catch (e) {
      console.error('Failed to parse LLM response:', e);
      return {
        serverName: mcpConfigs[0].name,
        reasoning: 'Fallback to default server due to parsing error'
      };
    }
  }
);

// Component to execute the MCP call
export const ExecuteMCPCall = gensx.Component<ExecuteMCPCallProps, string>(
  async ({ serverName, chatHistory, latestMessage, mcpConfigs }) => {
    const serverConfig = mcpConfigs.find(config => config.name === serverName);
    
    if (!serverConfig) {
      return `Error: Could not find MCP server configuration for ${serverName}`;
    }
    
    const mcpContext = createMCPContext(serverConfig);
    
    const prompt = `
      You have access to the ${serverName} MCP server with these commands:
      ${JSON.stringify(serverConfig.commands)}
      
      Based on the chat history and latest message, determine which command to use and what arguments to provide.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      Return the command name and arguments as a JSON object.
    `;
    
    // In a real implementation, this would call LLM with MCP tools
    const response = await mockLLMCall(`execute MCP call for ${serverName} with message: ${latestMessage}`);
    
    // Mock response for demonstration
    return response;
  }
);

// Component to format the final response
export const FormatResponse = gensx.Component<FormatResponseProps, string>(
  async ({ chatHistory, latestMessage, mcpResult }) => {
    const prompt = `
      Given the chat history, latest user message, and the result from the MCP server, 
      format a helpful, natural-sounding response to the user.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      MCP Result: ${mcpResult}
      
      Your response should incorporate the information from the MCP result in a helpful way.
    `;
    
    // In a real implementation, this would call GPT-4o or similar
    const response = await mockLLMCall(`format response for: ${latestMessage} with MCP result: ${mcpResult}`);
    
    return response;
  }
);

// Main chatbot component
export const Chatbot = gensx.Component<ChatbotProps, string>(
  async ({ chatHistory, latestMessage, mcpConfigs }) => {
    // Step 1: Choose the appropriate MCP server
    const { serverName, reasoning } = await ChooseMCPServer({
      chatHistory,
      latestMessage,
      mcpConfigs
    });
    
    console.log(`Selected MCP server: ${serverName}`);
    console.log(`Reasoning: ${reasoning}`);
    
    // Step 2: Execute the MCP call
    const mcpResult = await ExecuteMCPCall({
      serverName,
      chatHistory,
      latestMessage,
      mcpConfigs
    });
    
    // Step 3: Format the response
    const response = await FormatResponse({
      chatHistory,
      latestMessage,
      mcpResult
    });
    
    return response;
  }
);

// Helper function to process a new message
export const processMessage = async (
  chatHistory: Message[],
  latestMessage: string
): Promise<string> => {
  try {
    // In a real app, we would fetch the config from the server
    const response = await fetch('/config.json');
    const { mcpServers } = await response.json();
    
    return await Chatbot({
      chatHistory,
      latestMessage,
      mcpConfigs: mcpServers
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return 'Sorry, there was an error processing your request. Please try again.';
  }
};
