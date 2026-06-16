const express = require('express');
const auth = require('../middleware/auth');
const { analyzeExercise } = require('../services/geminiService');
const prisma = require('../lib/prisma');

const router = express.Router();

function isDateString(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ''));
}

function parsePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function parseNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

// MET values dictionary
const MET_VALUES = {
  'walking': 3.5,
  'running': 9.8,
  'cycling': 7.5,
  'yoga': 2.5,
  'swimming': 8.0,
  'cricket': 5.0,
  'weight training': 6.0,
  'badminton': 5.5
};

router.get('/log', auth, async (req, res) => {
  try {
    const { date } = req.query;
    if (!isDateString(date)) return res.status(400).json({ error: 'Date is required (YYYY-MM-DD)' });

    const logs = await prisma.exerciseLog.findMany({
      where: { user_id: req.user.id, date }
    });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/analyze', auth, async (req, res) => {
  try {
    const { description, duration_mins } = req.body;
    if (!description) {
      return res.status(400).json({ error: 'Description is required' });
    }

    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id }
    });

    if (!profile) {
      return res.status(400).json({ error: 'Please complete your profile first' });
    }

    const parsedDuration = duration_mins ? parsePositiveInteger(duration_mins) : null;
    if (duration_mins && !parsedDuration) {
      return res.status(400).json({ error: 'Duration must be a positive number of minutes.' });
    }

    const result = await analyzeExercise(description, parsedDuration, profile.weight_kg);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/log', auth, async (req, res) => {
  try {
    const { date, exercise_name, duration_mins, calories_burned: caloriesOverride } = req.body;
    const normalizedName = String(exercise_name || '').trim();
    const parsedDuration = parsePositiveInteger(duration_mins);
    const parsedCaloriesOverride = caloriesOverride != null ? parseNonNegativeInteger(caloriesOverride) : null;

    if (!isDateString(date) || !normalizedName || !parsedDuration || (caloriesOverride != null && parsedCaloriesOverride === null)) {
      return res.status(400).json({ error: 'Valid date, exercise name, duration, and calories are required.' });
    }
    
    // Fetch user weight to calculate calories burned
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id }
    });

    if (!profile) {
      return res.status(400).json({ error: 'Please complete your profile first' });
    }

    const weight_kg = profile.weight_kg;
    const met = MET_VALUES[normalizedName.toLowerCase()] || 4.0; // Default MET if not found

    // Formula: (MET * weight_kg * duration_mins) / 60
    const calories_burned = caloriesOverride != null
      ? parsedCaloriesOverride
      : Math.round((met * weight_kg * parsedDuration) / 60);

    const log = await prisma.exerciseLog.create({
      data: {
        user_id: req.user.id,
        date,
        exercise_name: normalizedName,
        duration_mins: parsedDuration,
        calories_burned
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

    const result = await prisma.exerciseLog.deleteMany({
      where: { id, user_id: req.user.id }
    });

    if (result.count === 0) {
      return res.status(404).json({ error: 'Exercise log not found.' });
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
