import gensx from './gensx';
import { MCPConfig, createMCPContext } from './mcp';

export interface Message {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

interface EvaluateQueryProps {
  chatHistory: Message[];
  latestMessage: string;
  mcpConfigs: Record<string, any>;
  apiKey: string | null;
  setLogs: (log: string) => void;
}

interface EvaluateQueryOutput {
  needsMCP: boolean;
  serverName?: string;
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

interface GenerateDirectResponseProps {
  chatHistory: Message[];
  latestMessage: string;
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
              ? 'You are a helpful assistant that responds in valid JSON format. Your response must be properly formatted JSON that can be parsed with JSON.parse(). Always include the property names in double quotes. DO NOT include markdown code blocks or any formatting in your response - just pure JSON.' 
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
            
            // Return a fallback that indicates not to use MCP
            return {
              needsMCP: false,
              reasoning: "Fallback due to JSON parsing error. Raw response: " + resultText.substring(0, 100)
            };
          }
        }
        
        // If we couldn't extract valid JSON, return a fallback
        console.error('Failed to parse response as JSON, returning fallback');
        return {
          needsMCP: false,
          reasoning: "Fallback due to JSON parsing error. No JSON pattern found."
        };
      }
    }
    
    return resultText;
  } catch (error) {
    console.error('Error calling OpenAI:', error);
    
    if (useJson) {
      return {
        needsMCP: false,
        reasoning: `Fallback due to error: ${error instanceof Error ? error.message : String(error)}`
      };
    } else {
      return `I apologize, but I encountered an error while processing your request. Could you try rephrasing your question?`;
    }
  }
};

export const EvaluateQuery = gensx.Component<EvaluateQueryProps, EvaluateQueryOutput>(
  async ({ chatHistory, latestMessage, mcpConfigs, apiKey, setLogs }) => {
    const logMessage = '🔍 *Starting query evaluation process...*';
    console.log(logMessage);
    setLogs(logMessage);
    
    const serverDescriptions = Object.entries(mcpConfigs).map(([name, config]) => 
      `${name}: ${JSON.stringify(config)}`
    ).join('\n');
    
    const prompt = `
      Given the following chat history and latest message, determine if an MCP server is needed to handle the request.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      Available MCP Servers:
      ${serverDescriptions}
      
      CAREFULLY EVALUATE whether this query requires accessing external data or services via an MCP server.
      Consider whether using one of the available MCP servers would SIGNIFICANTLY IMPROVE the quality, accuracy, or relevance of the response.
      
      If ANY of these conditions apply, an MCP server IS needed:
      1. The query requires specific data access that isn't part of your general knowledge
      2. The query would benefit from specialized tools or APIs
      3. The user is asking for real-time information or data processing
      4. The request requires integration with external systems
      5. The query involves domain-specific knowledge that an MCP server provides
      
      If the query is a simple greeting, general question, opinion, chitchat, or can be fully answered with your general knowledge, NO MCP server is needed.
      
      Evaluate carefully - if there's any doubt, evaluate which approach would give the best user experience.
      
      Return a JSON object with:
      - needsMCP: boolean indicating if an MCP server is needed (true/false)
      - serverName: (only if needsMCP is true) name of the chosen server
      - reasoning: detailed explanation of your decision, including why a particular server was chosen or why MCP is not needed
      
      IMPORTANT: Return ONLY a valid JSON object that can be parsed with JSON.parse(). Do NOT wrap it in markdown code blocks.
    `;
    
    setLogs(`🧠 *Generating prompt for query evaluation...*`);
    setLogs(`📤 *Sending request to LLM for query evaluation...*`);
    
    try {
      const response = await callOpenAI(prompt, apiKey, true);
      setLogs(`📥 *Received response from LLM for query evaluation*`);
      
      const result = response;
      
      const evaluationLog = `✅ *Query evaluation complete: ${result.needsMCP ? "Needs MCP" : "No MCP needed"}*`;
      const reasoningLog = `💭 *Reasoning: ${result.reasoning}*`;
      
      console.log(evaluationLog);
      console.log(reasoningLog);
      setLogs(evaluationLog);
      setLogs(reasoningLog);
      
      if (result.needsMCP && !result.serverName && Object.keys(mcpConfigs).length > 0) {
        // If MCP is needed but no server was specified, use the first available server
        const firstServerName = Object.keys(mcpConfigs)[0];
        result.serverName = firstServerName;
        setLogs(`ℹ️ *No specific server selected, using default: ${firstServerName}*`);
      }
      
      return result;
    } catch (e) {
      const errorLog = `⚠️ *Error during query evaluation: ${e instanceof Error ? e.message : String(e)}*`;
      console.error(errorLog);
      setLogs(errorLog);
      
      return {
        needsMCP: false,
        reasoning: 'Error during evaluation, falling back to direct response'
      };
    }
  }
);

export const GenerateDirectResponse = gensx.Component<GenerateDirectResponseProps, string>(
  async ({ chatHistory, latestMessage, apiKey, setLogs }) => {
    const generatingLog = `🖋️ *Generating direct response without MCP...*`;
    console.log(generatingLog);
    setLogs(generatingLog);
    
    const prompt = `
      Given the following chat history and latest message, provide a helpful response.
      
      Chat History:
      ${chatHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')}
      
      Latest Message: ${latestMessage}
      
      Provide a helpful, natural-sounding response to the user's message.
    `;
    
    setLogs(`🧠 *Generating prompt for direct response...*`);
    setLogs(`📤 *Sending request to LLM for direct response...*`);
    
    try {
      const response = await callOpenAI(prompt, apiKey);
      
      setLogs(`📥 *Received direct response (${response.length} chars)*`);
      const snippetLog = `📄 *Response snippet: "${response.substring(0, 50)}..."*`;
      console.log(snippetLog);
      setLogs(snippetLog);
      
      return response;
    } catch (error) {
      const errorMessage = `❌ *Error generating direct response: ${error instanceof Error ? error.message : String(error)}*`;
      console.error(errorMessage);
      setLogs(errorMessage);
      return `I apologize, but I encountered an error while processing your request. Could you try rephrasing your question?`;
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
      setLogs(`⚙️ *STEP 1: Evaluating if MCP is needed...*`);
      const { needsMCP, serverName, reasoning } = await EvaluateQuery({
        chatHistory,
        latestMessage,
        mcpConfigs,
        apiKey,
        setLogs
      });
      
      let response;
      
      if (needsMCP && serverName) {
        const selectedLog = `🎯 *MCP needed - Selected server: ${serverName}*`;
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
        
        setLogs(`⚙️ *STEP 3: Formatting response with MCP results...*`);
        response = await FormatResponse({
          chatHistory,
          latestMessage,
          mcpResult,
          apiKey,
          setLogs
        });
      } else {
        const directLog = `🎯 *No MCP needed - Generating direct response*`;
        const reasoningLog = `💭 *Reasoning: ${reasoning}*`;
        console.log(directLog);
        console.log(reasoningLog);
        setLogs(directLog);
        setLogs(reasoningLog);
        
        setLogs(`⚙️ *STEP 2: Generating direct response without MCP...*`);
        response = await GenerateDirectResponse({
          chatHistory,
          latestMessage,
          apiKey,
          setLogs
        });
      }
      
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

