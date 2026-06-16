const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');
const GEMINI_MODELS = ['gemini-flash-latest', 'gemini-3-flash-preview'];

function assertGeminiKey() {
  if (!apiKey || apiKey === 'your_gemini_api_key_here') {
    throw new Error('Gemini API key is missing. Add a valid GEMINI_API_KEY in backend/.env and restart the backend server.');
  }
}

function normalizeGeminiError(error) {
  const message = error?.message || '';
  if (message.includes('API key not valid') || message.includes('API_KEY_INVALID')) {
    return new Error('Gemini API key is invalid. Replace GEMINI_API_KEY in backend/.env with a valid key from Google AI Studio, then restart the backend server.');
  }
  if (message.includes('is not found for API version') || message.includes('not supported for generateContent')) {
    return new Error('Configured Gemini model is unavailable. Update GEMINI_MODEL in backend/services/geminiService.js to a model that supports generateContent.');
  }
  return error;
}

// 1. Define the exact JSON structure you want returned
const nutritionSchema = {
  type: SchemaType.OBJECT,
  properties: {
    name: {
      type: SchemaType.STRING,
      description: "Short display name for the full meal."
    },
    calories: {
      type: SchemaType.NUMBER,
      description: "Total estimated calories."
    },
    protein_g: {
      type: SchemaType.NUMBER,
      description: "Total estimated protein in grams."
    },
    carbs_g: {
      type: SchemaType.NUMBER,
      description: "Total estimated carbohydrates in grams."
    },
    fat_g: {
      type: SchemaType.NUMBER,
      description: "Total estimated fat in grams."
    },
    items: {
      type: SchemaType.ARRAY,
      description: "Individual foods detected in the meal.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          name: { type: SchemaType.STRING },
          quantity: { type: SchemaType.STRING },
          calories: { type: SchemaType.NUMBER },
          protein_g: { type: SchemaType.NUMBER },
          carbs_g: { type: SchemaType.NUMBER },
          fat_g: { type: SchemaType.NUMBER }
        },
        required: ["name", "quantity", "calories", "protein_g", "carbs_g", "fat_g"]
      }
    },
    health_analysis: {
      type: SchemaType.STRING,
      description: "A concise paragraph explaining the meal quality, balance, and notable nutrition points."
    },
    nutrition_facts: {
      type: SchemaType.ARRAY,
      description: "Detailed nutrition facts for the full meal.",
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING }
        },
        required: ["label", "value"]
      }
    }
  },
  required: ["name", "calories", "protein_g", "carbs_g", "fat_g", "items", "health_analysis", "nutrition_facts"],
};

const exerciseSchema = {
  type: SchemaType.OBJECT,
  properties: {
    exercise_name: { type: SchemaType.STRING },
    duration_mins: {
      type: SchemaType.NUMBER,
      description: "Estimated or provided duration in minutes. If not provided by the user, infer a practical duration from the activity description."
    },
    calories_burned: { type: SchemaType.NUMBER },
    fat_burn_g: { type: SchemaType.NUMBER },
    carbs_burn_g: { type: SchemaType.NUMBER },
    met_estimate: { type: SchemaType.NUMBER },
    intensity: { type: SchemaType.STRING },
    summary: { type: SchemaType.STRING },
    breakdown: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          label: { type: SchemaType.STRING },
          value: { type: SchemaType.STRING }
        },
        required: ["label", "value"]
      }
    }
  },
  required: ["exercise_name", "duration_mins", "calories_burned", "fat_burn_g", "carbs_burn_g", "met_estimate", "intensity", "summary", "breakdown"]
};

async function generateNutritionContent(parts, systemInstruction) {
  let lastError;

  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: nutritionSchema,
      },
      systemInstruction
    });

    try {
      const result = await model.generateContent(parts);
      return JSON.parse(result.response.text());
    } catch (error) {
      lastError = error;
      const message = error?.message || '';
      if (!message.includes('503') && !message.toLowerCase().includes('high demand')) {
        break;
      }
    }
  }

  throw lastError;
}

async function generateExerciseContent(prompt) {
  let lastError;

  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: exerciseSchema,
      },
      systemInstruction: "You are an exercise physiology assistant. Estimate calorie burn from activity, duration, body weight, and intensity. Fat and carbohydrate burn are estimates, not exact medical measurements. Return only JSON."
    });

    try {
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    } catch (error) {
      lastError = error;
      const message = error?.message || '';
      if (!message.includes('503') && !message.toLowerCase().includes('high demand')) {
        break;
      }
    }
  }

  throw lastError;
}

async function analyzeTextFood(description, qty) {
  assertGeminiKey();

  const prompt = `The user ate: "${description}" (quantity: ${qty}). Estimate the full meal nutrition. If this is a mixed meal, itemize each visible or named food separately. Include totals and detailed nutrition facts.`;

  try {
    return await generateNutritionContent(prompt, "You are a nutrition expert familiar with Indian cuisine. Be practical, estimate portions when exact weights are unknown, and return only the requested JSON.");
  } catch (error) {
    console.error("Gemini API Error (Text):", error);
    throw normalizeGeminiError(error);
  }
}

async function analyzePhotoFood(base64Image, mimeType) {
  assertGeminiKey();

  const prompt = "Analyze this meal photo. Detect each visible food item, estimate portions, itemize calories/protein/carbs/fat for each item, calculate full meal totals, write a short health analysis, and include detailed nutrition facts. If it is a thali or mixed plate, list every major component separately.";
  const imagePart = { inlineData: { data: base64Image, mimeType } };

  try {
    return await withTimeout(
      generateNutritionContent([prompt, imagePart], "You are a nutrition expert and food image analyst, especially familiar with Indian meals and thalis. Estimate portions carefully from the image and return only the requested JSON."),
      45000,
      'Photo analysis took too long. Please try again with a smaller or cropped image.'
    );
  } catch (error) {
    console.error("Gemini API Error (Photo):", error);
    throw normalizeGeminiError(error);
  }
}

async function analyzeExercise(description, durationMins, weightKg) {
  assertGeminiKey();

  const durationText = durationMins ? `${durationMins} minutes` : 'not provided; infer a practical duration from the described activity';
  const prompt = `Activity description: "${description}". Duration: ${durationText}. User weight: ${weightKg} kg. Estimate calories burned, fat burned in grams, carbohydrate burn in grams, MET value, intensity, and a concise breakdown. If the user gives count-based activity such as floors climbed, steps, sets, repetitions, or distance, use that information to infer duration and effort.`;

  try {
    return await generateExerciseContent(prompt);
  } catch (error) {
    console.error("Gemini API Error (Exercise):", error);
    throw normalizeGeminiError(error);
  }
}

async function chatWithNutritionAI(message, context = {}, image = null) {
  assertGeminiKey();

  const contextText = JSON.stringify(context, null, 2);
  const prompt = `User question: "${message}"

User context:
${contextText}

Answer like a practical nutrition coach. Use the user's profile and recent logs when helpful. Give clear, safe food/routine suggestions. Do not claim medical certainty. Keep the response concise and actionable.`;
  const parts = image?.base64Image && image?.mimeType
    ? [prompt, { inlineData: { data: image.base64Image, mimeType: image.mimeType } }]
    : prompt;

  let lastError;

  for (const modelName of GEMINI_MODELS) {
    const model = genAI.getGenerativeModel({
      model: modelName,
      systemInstruction: "You are NutriAI, a friendly nutrition and routine assistant for NutriTrack. You help users understand their food logs, calories, protein, exercise, and meal choices. You are not a doctor."
    });

    try {
      const result = await withTimeout(
        model.generateContent(parts),
        35000,
        'NutriAI took too long to respond. Please try again with a shorter question.'
      );
      return result.response.text();
    } catch (error) {
      lastError = error;
      const messageText = error?.message || '';
      if (!messageText.includes('503') && !messageText.toLowerCase().includes('high demand')) {
        break;
      }
    }
  }

  throw normalizeGeminiError(lastError);
}

function withTimeout(promise, timeoutMs, message) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeoutMs);
    })
  ]);
}

module.exports = { analyzeTextFood, analyzePhotoFood, analyzeExercise, chatWithNutritionAI };
