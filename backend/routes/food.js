const express = require('express');
const auth = require('../middleware/auth');
const { analyzeTextFood, analyzePhotoFood } = require('../services/geminiService');
const prisma = require('../lib/prisma');

const router = express.Router();

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function parseNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

router.post('/analyze-text', auth, async (req, res) => {
  try {
    const { description, qty } = req.body;
    if (!String(description || '').trim()) {
      return res.status(400).json({ error: 'Food description is required.' });
    }
    const result = await analyzeTextFood(description, qty || '1 serving');
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/analyze-photo', auth, async (req, res) => {
  try {
    const { base64Image, mimeType } = req.body;
    if (!base64Image || !mimeType) {
      return res.status(400).json({ error: 'Missing image data' });
    }

    const imageBytes = Math.ceil(base64Image.length * 0.75);
    if (imageBytes > 4 * 1024 * 1024) {
      return res.status(413).json({ error: 'Image is too large. Please crop it or upload a smaller JPEG/PNG photo.' });
    }

    const result = await analyzePhotoFood(base64Image, mimeType);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/log', auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!isDateString(date)) return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });

    const logs = await prisma.foodLog.findMany({
      where: { user_id: req.user.id, date }
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/log', auth, async (req, res) => {
  try {
    const { date, food_name, calories, protein_g, meal_type } = req.body;
    const parsedCalories = parseNonNegativeInteger(calories);
    const parsedProtein = parseNonNegativeInteger(protein_g);
    const normalizedFoodName = String(food_name || '').trim();

    if (!isDateString(date) || !normalizedFoodName || parsedCalories === null || parsedProtein === null) {
      return res.status(400).json({ error: 'Valid date, food name, calories, and protein are required.' });
    }
    
    const log = await prisma.foodLog.create({
      data: {
        user_id: req.user.id,
        date,
        food_name: normalizedFoodName,
        calories: parsedCalories,
        protein_g: parsedProtein,
        meal_type
      }
    });
    res.json(log);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/log/:id', auth, async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Valid log id is required.' });
    }

    const result = await prisma.foodLog.deleteMany({
      where: { id, user_id: req.user.id }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Food log not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
