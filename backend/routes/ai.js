const express = require('express');
const auth = require('../middleware/auth');
const { chatWithNutritionAI } = require('../services/geminiService');
const prisma = require('../lib/prisma');

const router = express.Router();
const MAX_CHAT_IMAGE_BYTES = 1.5 * 1024 * 1024;

router.post('/chat', auth, async (req, res) => {
  try {
    const { message, image } = req.body;
    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message is required' });
    }

    if (image) {
      if (!image.base64Image || !image.mimeType) {
        return res.status(400).json({ error: 'Missing image data' });
      }

      const imageBytes = Math.ceil(image.base64Image.length * 0.75);
      if (imageBytes > MAX_CHAT_IMAGE_BYTES) {
        return res.status(413).json({ error: 'Image is too large. Please choose another photo.' });
      }
    }

    const today = new Date().toISOString().slice(0, 10);
    const [user, profile, foodLogs, exerciseLogs] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id }, select: { name: true, email: true } }),
      prisma.profile.findUnique({ where: { user_id: req.user.id } }),
      prisma.foodLog.findMany({ where: { user_id: req.user.id, date: today } }),
      prisma.exerciseLog.findMany({ where: { user_id: req.user.id, date: today } })
    ]);

    const reply = await chatWithNutritionAI(message, {
      user,
      profile,
      today,
      todayFoodLogs: foodLogs,
      todayExerciseLogs: exerciseLogs
    }, image);

    res.json({ reply });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
