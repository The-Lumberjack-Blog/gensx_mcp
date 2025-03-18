
import gensx from './gensx';
import { MCPConfig, createMCPContext } from './mcp';

export interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface ChooseMCPServerProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpConfigs: Record<string, any>;
  apiKey: string | null;
}

interface ChooseMCPServerOutput {
  serverName: string;
  reasoning: string;
}

interface ExecuteMCPCallProps {
  serverName: string;
  chatHistory: Message[];
  latestMessage: string;
  mcpConfigs: Record<string, any>;
  apiKey: string | null;
}

interface FormatResponseProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpResult: string;
  apiKey: string | null;
}

interface ChatbotProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpConfigs: Record<string, any>;
  apiKey: string | null;
}

// LLM call function that uses OpenAI API
const callOpenAI = async (
  prompt: string, 
  apiKey: string | null, 
  useJson: boolean = false
): Promise<string> => {
  if (!apiKey) {
    throw new Error("OpenAI API key is required");
  }

  console.log('LLM Prompt:', prompt);
  
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',  // Using a more affordable model for most operations
        messages: [
          {
            role: 'system',
            content: useJson 
              ? 'You are a helpful assistant that responds in valid JSON format.' 
              : 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: useJson ? 0.1 : 0.7, // Lower temperature for JSON responses
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0].message.content;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    
    // Fallback to mock response for demo purposes
    if (useJson && prompt.includes('choose MCP server')) {
      // Get a random server name from the mcpConfigs
      return JSON.stringify({
        serverName: "sequential-thinking",
        reasoning: `Selected sequential-thinking because it's the most relevant for this query.`
      });
    } else if (prompt.includes('execute MCP call')) {
      return `Result from MCP server: Here's the information you requested about "${prompt.split(' ').slice(-3).join(' ')}"`;
    } else {
      return `Based on the MCP server results, I can provide you with information about "${prompt.split(' ').slice(-5).join(' ')}"`;
    }
  }
};

// Component to choose the appropriate MCP server
export const ChooseMCPServer = gensx.Component<ChooseMCPServerProps, ChooseMCPServerOutput>(
  async ({ chatHistory, latestMessage, mcpConfigs, apiKey }) => {
    console.log('_*Starting MCP server selection process...*_');
    
    // Convert the mcpConfigs object to a format we can use in the prompt
    const serverDescriptions = Object.entries(mcpConfigs).map(([name, config]) => 
      `${name}: ${JSON.stringify(config)}`
    ).join('\n');
    
    const prompt = `
      Given the following chat history and latest message, choose the most appropriate MCP server to handle the request.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      Available MCP Servers:
      ${serverDescriptions}
      
      Return a JSON object with:
      - serverName: the name of the chosen server
      - reasoning: brief explanation of why this server was chosen
    `;
    
    const response = await callOpenAI(prompt, apiKey, true);
    
    try {
      const result = JSON.parse(response);
      console.log(`_*MCP server selected: ${result.serverName}*_`);
      console.log(`_*Selection reasoning: ${result.reasoning}*_`);
      return result;
    } catch (e) {
      console.error('Failed to parse LLM response:', e);
      // Return the first server as fallback
      const firstServerName = Object.keys(mcpConfigs)[0];
      console.log(`_*MCP server fallback: ${firstServerName}*_`);
      return {
        serverName: firstServerName,
        reasoning: 'Fallback to default server due to parsing error'
      };
    }
  }
);

// Component to execute the MCP call
export const ExecuteMCPCall = gensx.Component<ExecuteMCPCallProps, string>(
  async ({ serverName, chatHistory, latestMessage, mcpConfigs, apiKey }) => {
    console.log(`_*Executing MCP call with server: ${serverName}*_`);
    
    const serverConfig = mcpConfigs[serverName];
    
    if (!serverConfig) {
      console.log(`_*Error: MCP server configuration not found for ${serverName}*_`);
      return `Error: Could not find MCP server configuration for ${serverName}`;
    }
    
    const mcpContext = createMCPContext(serverConfig);
    console.log(`_*MCP context created with config:*_`);
    console.log(serverConfig);
    
    const prompt = `
      You have access to the ${serverName} MCP server with these commands:
      ${JSON.stringify(serverConfig)}
      
      Based on the chat history and latest message, determine which command to use and what arguments to provide.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      Return a detailed explanation of what information you would retrieve from the server for this query.
    `;
    
    // In a real implementation, this would call LLM with MCP tools
    const response = await callOpenAI(prompt, apiKey);
    console.log(`_*MCP execution completed with response length: ${response.length} characters*_`);
    
    return response;
  }
);

// Component to format the final response
export const FormatResponse = gensx.Component<FormatResponseProps, string>(
  async ({ chatHistory, latestMessage, mcpResult, apiKey }) => {
    console.log('_*Formatting final response based on MCP result...*_');
    
    const prompt = `
      Given the chat history, latest user message, and the result from the MCP server, 
      format a helpful, natural-sounding response to the user.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      MCP Result: ${mcpResult}
      
      Your response should incorporate the information from the MCP result in a helpful way.
    `;
    
    const response = await callOpenAI(prompt, apiKey);
    console.log('_*Response formatting complete*_');
    
    return response;
  }
);

// Main chatbot component
export const Chatbot = gensx.Component<ChatbotProps, string>(
  async ({ chatHistory, latestMessage, mcpConfigs, apiKey }) => {
    console.log('_*==== Starting Chatbot Process ====*_');
    console.log(`_*Processing user message: "${latestMessage}"*_`);
    
    // Step 1: Choose the appropriate MCP server
    const { serverName, reasoning } = await ChooseMCPServer({
      chatHistory,
      latestMessage,
      mcpConfigs,
      apiKey
    });
    
    console.log(`_*Selected MCP server: ${serverName}*_`);
    console.log(`_*Reasoning: ${reasoning}*_`);
    
    // Step 2: Execute the MCP call
    const mcpResult = await ExecuteMCPCall({
      serverName,
      chatHistory,
      latestMessage,
      mcpConfigs,
      apiKey
    });
    
    // Step 3: Format the response
    const response = await FormatResponse({
      chatHistory,
      latestMessage,
      mcpResult,
      apiKey
    });
    
    console.log('_*==== Chatbot Process Complete ====*_');
    return response;
  }
);

// Helper function to process a new message
export const processMessage = async (
  chatHistory: Message[],
  latestMessage: string,
  apiKey: string | null
): Promise<string> => {
  try {
    // Fetch the config from the server
    const response = await fetch('/config.json');
    const { mcpServers } = await response.json();
    
    return await Chatbot({
      chatHistory,
      latestMessage,
      mcpConfigs: mcpServers,
      apiKey
    });
  } catch (error) {
    console.error('Error processing message:', error);
    return 'Sorry, there was an error processing your request. Please check your API key and try again.';
  }
};
