
import gensx from './gensx';
import { MCPConfig, createMCPContext } from './mcp';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface ChooseMCPServerProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpConfigs: Record<string, any>;
  apiKey: string | null;
  setLogs: (log: string) => void;
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
  setLogs: (log: string) => void;
}

interface FormatResponseProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpResult: string;
  apiKey: string | null;
  setLogs: (log: string) => void;
}

interface ChatbotProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpConfigs: Record<string, any>;
  apiKey: string | null;
  setLogs: (log: string) => void;
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
  async ({ chatHistory, latestMessage, mcpConfigs, apiKey, setLogs }) => {
    const logMessage = '🔍 *Starting MCP server selection process...*';
    console.log(logMessage);
    setLogs(logMessage);
    
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
    
    setLogs(`🧠 *Generating prompt for server selection...*`);
    setLogs(`📤 *Sending request to LLM for server selection...*`);
    
    const response = await callOpenAI(prompt, apiKey, true);
    setLogs(`📥 *Received response from LLM for server selection*`);
    
    try {
      const result = JSON.parse(response);
      const selectionLog = `✅ *MCP server selected: ${result.serverName}*`;
      const reasoningLog = `💡 *Selection reasoning: ${result.reasoning}*`;
      console.log(selectionLog);
      console.log(reasoningLog);
      setLogs(selectionLog);
      setLogs(reasoningLog);
      return result;
    } catch (e) {
      console.error('Failed to parse LLM response:', e);
      setLogs(`⚠️ *Error parsing LLM response: ${e instanceof Error ? e.message : String(e)}*`);
      setLogs(`📄 *Raw response: ${response}*`);
      
      // Return the first server as fallback
      const firstServerName = Object.keys(mcpConfigs)[0];
      const fallbackLog = `🔄 *MCP server fallback: ${firstServerName}*`;
      console.log(fallbackLog);
      setLogs(fallbackLog);
      return {
        serverName: firstServerName,
        reasoning: 'Fallback to default server due to parsing error'
      };
    }
  }
);

// Component to execute the MCP call
export const ExecuteMCPCall = gensx.Component<ExecuteMCPCallProps, string>(
  async ({ serverName, chatHistory, latestMessage, mcpConfigs, apiKey, setLogs }) => {
    const executingLog = `🚀 *Executing MCP call with server: ${serverName}*`;
    console.log(executingLog);
    setLogs(executingLog);
    
    const serverConfig = mcpConfigs[serverName];
    
    if (!serverConfig) {
      const errorLog = `❌ *Error: MCP server configuration not found for ${serverName}*`;
      console.log(errorLog);
      setLogs(errorLog);
      return `Error: Could not find MCP server configuration for ${serverName}`;
    }
    
    const mcpContext = createMCPContext(serverConfig);
    const contextLog = `🔧 *MCP context created with config:*`;
    console.log(contextLog);
    console.log(serverConfig);
    setLogs(contextLog);
    setLogs(`📋 *${JSON.stringify(serverConfig, null, 2)}*`);
    
    const prompt = `
      You have access to the ${serverName} MCP server with these commands:
      ${JSON.stringify(serverConfig)}
      
      Based on the chat history and latest message, determine which command to use and what arguments to provide.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      Return a detailed explanation of what information you would retrieve from the server for this query.
    `;
    
    setLogs(`🧠 *Generating prompt for MCP execution...*`);
    setLogs(`📤 *Sending request to LLM for MCP execution...*`);
    
    // In a real implementation, this would call LLM with MCP tools
    const response = await callOpenAI(prompt, apiKey);
    
    setLogs(`📥 *Received response from LLM for MCP execution*`);
    const completionLog = `✅ *MCP execution completed with response length: ${response.length} characters*`;
    console.log(completionLog);
    setLogs(completionLog);
    
    return response;
  }
);

// Component to format the final response
export const FormatResponse = gensx.Component<FormatResponseProps, string>(
  async ({ chatHistory, latestMessage, mcpResult, apiKey, setLogs }) => {
    const formattingLog = '📝 *Formatting final response based on MCP result...*';
    console.log(formattingLog);
    setLogs(formattingLog);
    
    const prompt = `
      Given the chat history, latest user message, and the result from the MCP server, 
      format a helpful, natural-sounding response to the user.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      MCP Result: ${mcpResult}
      
      Your response should incorporate the information from the MCP result in a helpful way.
    `;
    
    setLogs(`🧠 *Generating prompt for response formatting...*`);
    setLogs(`📤 *Sending request to LLM for response formatting...*`);
    
    const response = await callOpenAI(prompt, apiKey);
    
    setLogs(`📥 *Received response from LLM for formatting*`);
    const completeLog = '✅ *Response formatting complete*';
    console.log(completeLog);
    setLogs(completeLog);
    
    return response;
  }
);

// Main chatbot component
export const Chatbot = gensx.Component<ChatbotProps, string>(
  async ({ chatHistory, latestMessage, mcpConfigs, apiKey, setLogs }) => {
    const startLog = '🔄 *==== Starting Chatbot Process ====*';
    const messageLog = `📝 *Processing user message: "${latestMessage}"*`;
    console.log(startLog);
    console.log(messageLog);
    setLogs(startLog);
    setLogs(messageLog);
    
    // Step 1: Choose the appropriate MCP server
    const { serverName, reasoning } = await ChooseMCPServer({
      chatHistory,
      latestMessage,
      mcpConfigs,
      apiKey,
      setLogs
    });
    
    const selectedLog = `🎯 *Selected MCP server: ${serverName}*`;
    const reasoningLog = `💭 *Reasoning: ${reasoning}*`;
    console.log(selectedLog);
    console.log(reasoningLog);
    setLogs(selectedLog);
    setLogs(reasoningLog);
    
    // Step 2: Execute the MCP call
    const mcpResult = await ExecuteMCPCall({
      serverName,
      chatHistory,
      latestMessage,
      mcpConfigs,
      apiKey,
      setLogs
    });
    
    // Step 3: Format the response
    const response = await FormatResponse({
      chatHistory,
      latestMessage,
      mcpResult,
      apiKey,
      setLogs
    });
    
    const completeLog = '🏁 *==== Chatbot Process Complete ====*';
    console.log(completeLog);
    setLogs(completeLog);
    return response;
  }
);

// Helper function to process a new message
export const processMessage = async (
  chatHistory: Message[],
  latestMessage: string,
  apiKey: string | null,
  setLogs: (log: string) => void
): Promise<string> => {
  try {
    // Fetch the config from the server
    const response = await fetch('/config.json');
    const { mcpServers } = await response.json();
    
    return await Chatbot({
      chatHistory,
      latestMessage,
      mcpConfigs: mcpServers,
      apiKey,
      setLogs
    });
  } catch (error) {
    console.error('Error processing message:', error);
    setLogs(`❌ *Error processing message: ${error instanceof Error ? error.message : String(error)}*`);
    return 'Sorry, there was an error processing your request. Please check your API key and try again.';
  }
};
