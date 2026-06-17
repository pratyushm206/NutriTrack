const { GoogleGenerativeAI, SchemaType } = require('@google/generative-ai');

const apiKey = process.env.GEMINI_API_KEY;
const genAI = new GoogleGenerativeAI(apiKey || '');

// Primary model used for food photo/text analysis and exercise estimation.
const PRIMARY_GEMINI_MODEL = 'gemini-3.1-flash-lite';
// Lighter/cheaper model: used as (a) the fallback for primary calls, and
// (b) the main model for NutriAI chat, since chat doesn't need flash's heavier reasoning.
const LITE_GEMINI_MODEL = 'gemini-3.1-flash-lite';

// One real attempt on the primary model, one retry on primary (in case of a
// genuine transient blip), then ONE final attempt on the lite model. This is
// 2 Gemini calls in the worst case (not 3), and the lite call only happens
// once primary has definitively failed.
const MAX_PRIMARY_ATTEMPTS = 2;
const PRIMARY_RETRY_DELAY_MS = 2000;

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
  if (isTransientGeminiError(error)) {
    return new Error('NutriAI is currently experiencing high demand. Please try again in a few moments.');
  }
  if (message.includes('is not found for API version') || message.includes('not supported for generateContent')) {
    return new Error('Configured Gemini model is unavailable. Update the Gemini model name in backend/services/geminiService.js to a model that supports generateContent.');
  }
  return error;
}

function isTransientGeminiError(error) {
  const message = String(error?.message || '').toLowerCase();
  const status = error?.status || error?.statusCode || error?.response?.status;

  return status === 503
    || message.includes('503')
    || message.includes('high demand')
    || message.includes('service unavailable')
    || message.includes('temporarily unavailable')
    || message.includes('temporary failure')
    || message.includes('transient');
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Runs `generate` against the primary model first. Only on a transient
 * failure does it retry primary once, and only after THAT fails does it
 * fall back to the lite model — a single time, no further retries.
 *
 * createModel(modelName) -> model instance
 * generate(model) -> Promise<result>
 */
async function runGeminiWithFallback(createModel, generate) {
  let lastError;

  // Try the primary model up to MAX_PRIMARY_ATTEMPTS times.
  for (let attempt = 1; attempt <= MAX_PRIMARY_ATTEMPTS; attempt += 1) {
    console.log(`Gemini model: ${PRIMARY_GEMINI_MODEL} (attempt ${attempt}/${MAX_PRIMARY_ATTEMPTS})`);
    const model = createModel(PRIMARY_GEMINI_MODEL);

    try {
      return await generate(model);
    } catch (error) {
      lastError = error;
      if (!isTransientGeminiError(error)) {
        // Non-transient error (bad key, invalid model, bad request, etc.) —
        // don't waste time retrying or falling back, just surface it.
        throw error;
      }
      if (attempt < MAX_PRIMARY_ATTEMPTS) {
        console.log(`Transient error on ${PRIMARY_GEMINI_MODEL}, retrying in ${PRIMARY_RETRY_DELAY_MS}ms`);
        await wait(PRIMARY_RETRY_DELAY_MS);
      }
    }
  }

  // Primary model exhausted its attempts — fall back to lite, once.
  console.log(`Falling back to lite model: ${LITE_GEMINI_MODEL}`);
  try {
    const model = createModel(LITE_GEMINI_MODEL);
    return await generate(model);
  } catch (error) {
    throw isTransientGeminiError(error) ? error : error;
  } finally {
    if (lastError) {
      // no-op, kept for clarity that lastError was primary's failure reason
    }
  }
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
  return runGeminiWithFallback(
    modelName => genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: nutritionSchema,
      },
      systemInstruction
    }),
    async model => {
      const result = await model.generateContent(parts);
      return JSON.parse(result.response.text());
    }
  );
}

async function generateExerciseContent(prompt) {
  return runGeminiWithFallback(
    modelName => genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: "application/json",
        responseSchema: exerciseSchema,
      },
      systemInstruction: "You are an exercise physiology assistant. Estimate calorie burn from activity, duration, body weight, and intensity. Fat and carbohydrate burn are estimates, not exact medical measurements. Return only JSON."
    }),
    async model => {
      const result = await model.generateContent(prompt);
      return JSON.parse(result.response.text());
    }
  );
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
      'Photo analysis took too long. Please try again in a few moments.'
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

// NutriAI chat runs directly on the lite model — no fallback chain needed
// since flash-lite is already the "light" model and chat responses don't
// need flash-level reasoning. This also halves chat latency/cost vs before.
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

  try {
    const model = genAI.getGenerativeModel({
      model: LITE_GEMINI_MODEL,
      systemInstruction: "You are NutriAI, a friendly nutrition and routine assistant for NutriTrack. You help users understand their food logs, calories, protein, exercise, and meal choices. You are not a doctor."
    });

    const result = await withTimeout(
      model.generateContent(parts),
      35000,
      'NutriAI took too long to respond. Please try again with a shorter question.'
    );
    return result.response.text();
  } catch (error) {
    console.error("Gemini API Error (Chat):", error);
    throw normalizeGeminiError(error);
  }
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