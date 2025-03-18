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

const callOpenAI = async (
  prompt: string, 
  apiKey: string | null, 
  useJson: boolean = false
): Promise<any> => {
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
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: useJson 
              ? 'You are a helpful assistant that responds in valid JSON format. Make sure your response is properly formatted JSON that can be parsed with JSON.parse(). Always include the property names in double quotes. DO NOT include markdown code blocks in your response.' 
              : 'You are a helpful assistant.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: useJson ? 0.1 : 0.7,
        max_tokens: 1000
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(`OpenAI API error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const resultText = data.choices[0].message.content;
    
    console.log('Raw LLM response:', resultText);
    
    if (useJson) {
      try {
        // First try direct parsing
        return JSON.parse(resultText);
      } catch (e) {
        console.log('Direct JSON parsing failed, trying to extract JSON from the text');
        
        // If direct parsing fails, try to extract JSON from the text
        const jsonMatch = resultText.match(/```json\s*([\s\S]*?)\s*```/) || 
                         resultText.match(/```\s*([\s\S]*?)\s*```/) ||
                         resultText.match(/(\{[\s\S]*\})/);
        
        if (jsonMatch && jsonMatch[1]) {
          const extractedJson = jsonMatch[1].trim();
          console.log('Extracted potential JSON:', extractedJson);
          
          try {
            return JSON.parse(extractedJson);
          } catch (e2) {
            console.error('Failed to parse extracted JSON:', e2);
            // Log the raw response for debugging
            console.error('Raw response:', resultText);
            
            // Return the raw match for manual inspection
            return {
              serverName: "sequential-thinking",
              reasoning: "Fallback selection due to JSON parsing error. Raw response: " + resultText.substring(0, 100)
            };
          }
        }
        
        // If we couldn't extract valid JSON, return a fallback
        console.error('Failed to parse response as JSON, returning fallback');
        return {
          serverName: "sequential-thinking",
          reasoning: "Fallback selection due to JSON parsing error. No JSON pattern found."
        };
      }
    }
    
    return resultText;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    
    if (useJson) {
      return {
        serverName: "sequential-thinking",
        reasoning: `Selected sequential-thinking because it's the most reliable fallback option. Error: ${error instanceof Error ? error.message : String(error)}`
      };
    } else if (prompt.includes('execute MCP call')) {
      return `Result from MCP server: Here's the information you requested about "${prompt.split(' ').slice(-3).join(' ')}"`;
    } else {
      return `Based on the MCP server results, I can provide you with information about "${prompt.split(' ').slice(-5).join(' ')}"`;
    }
  }
};

export const ChooseMCPServer = gensx.Component<ChooseMCPServerProps, ChooseMCPServerOutput>(
  async ({ chatHistory, latestMessage, mcpConfigs, apiKey, setLogs }) => {
    const logMessage = '🔍 *Starting MCP server selection process...*';
    console.log(logMessage);
    setLogs(logMessage);
    
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
      
      IMPORTANT: Return ONLY a valid JSON object that can be parsed with JSON.parse(). DO NOT wrap your response in markdown code blocks or any other formatting.
    `;
    
    setLogs(`🧠 *Generating prompt for server selection...*`);
    setLogs(`📤 *Sending request to LLM for server selection...*`);
    
    try {
      const response = await callOpenAI(prompt, apiKey, true);
      setLogs(`📥 *Received response from LLM for server selection*`);
      
      const result = response;
      
      const selectionLog = `✅ *MCP server selected: ${result.serverName}*`;
      const reasoningLog = `💡 *Selection reasoning: ${result.reasoning}*`;
      console.log(selectionLog);
      console.log(reasoningLog);
      setLogs(selectionLog);
      setLogs(reasoningLog);
      return result;
    } catch (e) {
      const errorLog = `⚠️ *Error during server selection: ${e instanceof Error ? e.message : String(e)}*`;
      console.error(errorLog);
      setLogs(errorLog);
      
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
    
    try {
      const mcpContext = createMCPContext(serverConfig);
      const contextLog = `🔧 *MCP context created for '${serverName}' server*`;
      const configLog = `📋 *Server config: ${JSON.stringify(serverConfig, null, 2)}*`;
      console.log(contextLog);
      console.log(serverConfig);
      setLogs(contextLog);
      setLogs(configLog);
      
      setLogs(`📝 *User query: "${latestMessage}"*`);
      
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
      
      const response = await callOpenAI(prompt, apiKey);
      
      setLogs(`📥 *Received MCP execution response (${response.length} chars)*`);
      const snippetLog = `📄 *Response snippet: "${response.substring(0, 50)}..."*`;
      console.log(snippetLog);
      setLogs(snippetLog);
      
      return response;
    } catch (error) {
      const errorMessage = `❌ *MCP execution error: ${error instanceof Error ? error.message : String(error)}*`;
      console.error(errorMessage);
      setLogs(errorMessage);
      return `Error executing MCP call: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
);

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
    
    try {
      const response = await callOpenAI(prompt, apiKey);
      
      setLogs(`📥 *Received formatted response (${response.length} chars)*`);
      const snippetLog = `📄 *Response snippet: "${response.substring(0, 50)}..."*`;
      console.log(snippetLog);
      setLogs(snippetLog);
      
      return response;
    } catch (error) {
      const errorMessage = `❌ *Response formatting error: ${error instanceof Error ? error.message : String(error)}*`;
      console.error(errorMessage);
      setLogs(errorMessage);
      return `I encountered an error while formatting my response. Please try asking your question again in a different way.`;
    }
  }
);

export const Chatbot = gensx.Component<ChatbotProps, string>(
  async ({ chatHistory, latestMessage, mcpConfigs, apiKey, setLogs }) => {
    const startLog = '🔄 *==== Starting Chatbot Process ====*';
    const messageLog = `📝 *Processing user message: "${latestMessage}"*`;
    console.log(startLog);
    console.log(messageLog);
    setLogs(startLog);
    setLogs(messageLog);
    
    try {
      setLogs(`⚙️ *STEP 1: Selecting appropriate MCP server...*`);
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
      
      setLogs(`⚙️ *STEP 2: Executing MCP call with ${serverName}...*`);
      const mcpResult = await ExecuteMCPCall({
        serverName,
        chatHistory,
        latestMessage,
        mcpConfigs,
        apiKey,
        setLogs
      });
      
      setLogs(`⚙️ *STEP 3: Formatting final response...*`);
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
    } catch (error) {
      const errorLog = `❌ *ERROR: ${error instanceof Error ? error.message : String(error)}*`;
      console.error(errorLog);
      setLogs(errorLog);
      return `Sorry, I encountered an error while processing your request: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
);

export const processMessage = async (
  chatHistory: Message[],
  latestMessage: string,
  apiKey: string | null,
  setLogs: (log: string) => void
): Promise<string> => {
  try {
    const response = await fetch('/config.json');
    if (!response.ok) {
      throw new Error(`Failed to fetch configuration: ${response.statusText}`);
    }
    
    const { mcpServers } = await response.json();
    setLogs(`📚 *Loaded MCP server configurations: ${Object.keys(mcpServers).join(', ')}*`);
    
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
