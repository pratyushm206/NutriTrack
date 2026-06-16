const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

const RETENTION_OPTIONS = new Set(['forever', '1_year', '1_month']);

function retentionCutoff(value) {
  const cutoff = new Date();
  if (value === '1_year') {
    cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1);
    return cutoff.toISOString().slice(0, 10);
  }
  if (value === '1_month') {
    cutoff.setUTCMonth(cutoff.getUTCMonth() - 1);
    return cutoff.toISOString().slice(0, 10);
  }
  return null;
}

// Calculate TDEE using Mifflin-St Jeor formula
function calculateTDEE(weight_kg, height_cm, age, gender, activity_level) {
  let bmr;
  if (gender.toLowerCase() === 'male') {
    bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) + 5;
  } else {
    bmr = (10 * weight_kg) + (6.25 * height_cm) - (5 * age) - 161;
  }

  const multipliers = {
    sedentary: 1.2,
    light: 1.375,
    moderate: 1.55,
    active: 1.725,
    very_active: 1.9
  };

  return Math.round(bmr * (multipliers[activity_level.toLowerCase()] || 1.2));
}

function parsePositiveNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parsePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

router.get('/', auth, async (req, res) => {
  try {
    const profile = await prisma.profile.findUnique({
      where: { user_id: req.user.id }
    });
    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/', auth, async (req, res) => {
  try {
    const { age, gender, weight_kg, height_cm, activity_level, goal } = req.body;
    const parsedAge = parsePositiveInteger(age);
    const parsedWeight = parsePositiveNumber(weight_kg);
    const parsedHeight = parsePositiveNumber(height_cm);
    const normalizedGender = String(gender || '').trim();
    const normalizedActivity = String(activity_level || '').trim();
    const normalizedGoal = String(goal || '').trim();

    if (!parsedAge || !parsedWeight || !parsedHeight || !normalizedGender || !normalizedActivity || !normalizedGoal) {
      return res.status(400).json({ error: 'Valid age, gender, weight, height, activity level, and goal are required.' });
    }
    
    const tdee = calculateTDEE(parsedWeight, parsedHeight, parsedAge, normalizedGender, normalizedActivity);
    const protein_target = Math.round(parsedWeight * 1.8);

    const profileData = {
      user_id: req.user.id,
      age: parsedAge,
      gender: normalizedGender,
      weight_kg: parsedWeight,
      height_cm: parsedHeight,
      activity_level: normalizedActivity,
      goal: normalizedGoal,
      tdee,
      protein_target
    };

    const profile = await prisma.profile.upsert({
      where: { user_id: req.user.id },
      update: profileData,
      create: profileData
    });

    res.json(profile);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/retention', auth, async (req, res) => {
  try {
    const settings = await prisma.userSettings.findUnique({
      where: { user_id: req.user.id }
    });

    res.json({ dataRetention: settings?.data_retention || 'forever' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/retention', auth, async (req, res) => {
  try {
    const { dataRetention } = req.body;
    if (!RETENTION_OPTIONS.has(dataRetention)) {
      return res.status(400).json({ error: 'Invalid data retention option.' });
    }

    await prisma.userSettings.upsert({
      where: { user_id: req.user.id },
      update: { data_retention: dataRetention },
      create: { user_id: req.user.id, data_retention: dataRetention }
    });

    const cutoff = retentionCutoff(dataRetention);
    let deletedFoodLogs = 0;
    let deletedExerciseLogs = 0;

    if (cutoff) {
      const [foodResult, exerciseResult] = await prisma.$transaction([
        prisma.foodLog.deleteMany({ where: { user_id: req.user.id, date: { lt: cutoff } } }),
        prisma.exerciseLog.deleteMany({ where: { user_id: req.user.id, date: { lt: cutoff } } })
      ]);
      deletedFoodLogs = foodResult.count;
      deletedExerciseLogs = exerciseResult.count;
    }

    res.json({ dataRetention, deletedFoodLogs, deletedExerciseLogs });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
