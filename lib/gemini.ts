import { GoogleGenerativeAI } from "@google/generative-ai";

function getGenAI() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not set in environment variables");
  }
  return new GoogleGenerativeAI(apiKey);
}

/**
 * Reusable AI function to generate content using Gemini
 * @param request - Request parameters for AI generation
 * @returns AI-generated text response
 */
export interface AIGenerateRequest {
  prompt: string;
  model?: string;
}

export interface AIGenerateResponse {
  text: string;
}

export async function generateAIResponse(
  request: AIGenerateRequest
): Promise<AIGenerateResponse> {
  const genAI = getGenAI();
  
  // Get model name with proper precedence: request.model > env var
  // Trim whitespace and check for empty strings
  const rawEnvModel = process.env.GEMINI_MODEL;
  const envModel = rawEnvModel?.trim();
  const requestModel = request.model?.trim();
  
  // Debug logging (only in development, without exposing env keys)
  if (process.env.NODE_ENV === "development") {
    console.log(`[Gemini] Environment check:`, {
      rawEnvModel: rawEnvModel || '(undefined)',
      envModel: envModel || '(empty or undefined)',
      envModelLength: envModel?.length || 0,
      requestModel: requestModel || '(not provided)',
    });
  }
  
  // Determine model name - no fallback, must be explicitly configured
  let modelName: string;
  if (requestModel && requestModel.length > 0) {
    modelName = requestModel;
  } else if (envModel && envModel.length > 0) {
    modelName = envModel;
  } else {
    const errorMsg = `GEMINI_MODEL is not configured. Please set GEMINI_MODEL in your .env.local file or provide a model in the request. 
    Current value: "${rawEnvModel}" (type: ${typeof rawEnvModel}, length: ${rawEnvModel?.length || 0})`;
    console.error(`[Gemini] Configuration error:`, errorMsg);
    throw new Error(errorMsg);
  }
  
  // Log for debugging
  console.log(`[Gemini] Using model: ${modelName} (from ${requestModel ? 'request parameter' : 'GEMINI_MODEL env'})`);
  
  const model = genAI.getGenerativeModel({ model: modelName });

  try {
    const result = await model.generateContent(request.prompt);
    const response = await result.response;
    const generatedText = response.text();

    // Clean up the response - remove any markdown code blocks if present
    const cleanedText = generatedText
      .replace(/```[\s\S]*?```/g, "")
      .replace(/^```\w*\n?/gm, "")
      .replace(/```$/gm, "")
      .trim();

    return { text: cleanedText };
  } catch (error) {
    console.error("Error generating AI response:", error);
    throw error;
  }
}

/**
 * Customize email for a specific professor
 */
export async function customizeEmail({
  baseTemplate,
  professorName,
  universityName,
}: {
  baseTemplate: string;
  professorName: string;
  universityName: string;
}): Promise<string> {
  const prompt = `You are helping to customize an email to a professor. Please personalize the following email template for Professor ${professorName} at ${universityName}.

Keep the base message structure and tone the same, but make subtle, natural adjustments to:
1. Make the email feel more personalized to ${universityName} if relevant
2. Ensure the email flows naturally and professionally
3. Keep all the original content, just make it feel more tailored
4. IMPORTANT: Keep ALL placeholder tags exactly as they are, including:
   - [PROFESSOR_NAME], [PROFESSOR_EMAIL], [UNIVERSITY_NAME]
   - [YOUR_NAME], [YOUR_EMAIL], [YOUR_DEGREE], [YOUR_UNIVERSITY], [YOUR_GPA]
   Do NOT replace these placeholders - they will be replaced automatically later

Base email template:
${baseTemplate}

Return only the customized email text, without any additional commentary or markdown formatting.`;

  const response = await generateAIResponse({ prompt });
  return response.text;
}

/**
 * Customize or improve email template
 */
export async function customizeTemplate({
  template,
  customizationPrompt,
}: {
  template: string;
  customizationPrompt?: string;
}): Promise<string> {
  const prompt = customizationPrompt
    ? `You are helping to improve an email template. ${customizationPrompt}

Current email template:
${template}

Please improve or customize this template based on the instructions above. Make sure to:
1. Keep ALL placeholder tags exactly as they are, including:
   - [PROFESSOR_NAME], [PROFESSOR_EMAIL], [UNIVERSITY_NAME]
   - [YOUR_NAME], [YOUR_EMAIL], [YOUR_DEGREE], [YOUR_UNIVERSITY], [YOUR_GPA]
2. Maintain the professional tone and structure
3. Improve the template according to the customization instructions
4. Return only the improved template text without any additional commentary or markdown formatting`
    : `You are helping to improve an email template for professor outreach. Please review and enhance the following template to make it more professional, engaging, and effective.

Current email template:
${template}

Please improve this template by:
1. Making it more professional and polished
2. Improving clarity and flow
3. Enhancing the persuasive elements
4. Keeping ALL placeholder tags exactly as they are, including:
   - [PROFESSOR_NAME], [PROFESSOR_EMAIL], [UNIVERSITY_NAME]
   - [YOUR_NAME], [YOUR_EMAIL], [YOUR_DEGREE], [YOUR_UNIVERSITY], [YOUR_GPA]
5. Maintaining the overall structure and key points

Return only the improved template text without any additional commentary or markdown formatting.`;

  const response = await generateAIResponse({ prompt });
  return response.text;
}

