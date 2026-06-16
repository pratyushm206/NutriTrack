const express = require('express');
const auth = require('../middleware/auth');
const prisma = require('../lib/prisma');

const router = express.Router();

function parseDate(value) {
  const dateText = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateText)) return null;
  const date = new Date(`${dateText}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) || formatDate(date) !== dateText ? null : date;
}

function formatDate(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function eachDate(start, end) {
  const dates = [];
  for (let day = new Date(start); day <= end; day = addDays(day, 1)) {
    dates.push(formatDate(day));
  }
  return dates;
}

router.get('/weekly', auth, async (req, res) => {
  try {
    const start = parseDate(req.query.start);
    const end = parseDate(req.query.end);
    if (!start || !end) {
      return res.status(400).json({ error: 'Valid start and end dates are required (YYYY-MM-DD)' });
    }
    if (start > end) {
      return res.status(400).json({ error: 'Start date must be before or equal to end date.' });
    }
    if (eachDate(start, end).length > 31) {
      return res.status(400).json({ error: 'Date range cannot exceed 31 days.' });
    }

    const dates = eachDate(start, end);
    const [profile, foodLogs, exerciseLogs] = await Promise.all([
      prisma.profile.findUnique({ where: { user_id: req.user.id } }),
      prisma.foodLog.findMany({
        where: { user_id: req.user.id, date: { in: dates } },
        orderBy: [{ date: 'asc' }, { created_at: 'asc' }]
      }),
      prisma.exerciseLog.findMany({
        where: { user_id: req.user.id, date: { in: dates } },
        orderBy: [{ date: 'asc' }, { created_at: 'asc' }]
      })
    ]);

    const rows = dates.map(date => {
      const foods = foodLogs.filter(log => log.date === date);
      const exercises = exerciseLogs.filter(log => log.date === date);
      const foodCalories = foods.reduce((sum, item) => sum + Number(item.calories || 0), 0);
      const protein = foods.reduce((sum, item) => sum + Number(item.protein_g || 0), 0);
      const exerciseCalories = exercises.reduce((sum, item) => sum + Number(item.calories_burned || 0), 0);
      const remaining = Number(profile?.tdee || 0) - foodCalories + exerciseCalories;

      return {
        date,
        foodCalories,
        exerciseCalories,
        remaining,
        protein,
        foodEntries: foods.length,
        exerciseEntries: exercises.length,
        tracked: foods.length > 0 || exercises.length > 0,
        withinGoal: foodCalories > 0 && profile?.tdee ? foodCalories - exerciseCalories <= profile.tdee : false
      };
    });

    const totals = rows.reduce((acc, row) => ({
      foodCalories: acc.foodCalories + row.foodCalories,
      exerciseCalories: acc.exerciseCalories + row.exerciseCalories,
      remaining: acc.remaining + row.remaining,
      protein: acc.protein + row.protein,
      foodEntries: acc.foodEntries + row.foodEntries,
      exerciseEntries: acc.exerciseEntries + row.exerciseEntries,
      trackedDays: acc.trackedDays + (row.tracked ? 1 : 0),
      daysOnTrack: acc.daysOnTrack + (row.withinGoal ? 1 : 0)
    }), {
      foodCalories: 0,
      exerciseCalories: 0,
      remaining: 0,
      protein: 0,
      foodEntries: 0,
      exerciseEntries: 0,
      trackedDays: 0,
      daysOnTrack: 0
    });

    res.json({
      start: formatDate(start),
      end: formatDate(end),
      profile,
      rows,
      totals,
      retention: 'forever'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/streak', auth, async (req, res) => {
  try {
    const today = parseDate(req.query.today) || new Date();
    const start = addDays(today, -365);
    const dates = eachDate(start, today);

    const [foodLogs, exerciseLogs] = await Promise.all([
      prisma.foodLog.findMany({ where: { user_id: req.user.id, date: { in: dates } }, select: { date: true } }),
      prisma.exerciseLog.findMany({ where: { user_id: req.user.id, date: { in: dates } }, select: { date: true } })
    ]);

    const trackedDates = new Set([...foodLogs, ...exerciseLogs].map(log => log.date));
    let current = 0;
    for (let day = new Date(today); day >= start; day = addDays(day, -1)) {
      if (!trackedDates.has(formatDate(day))) break;
      current += 1;
    }

    let best = 0;
    let active = 0;
    dates.forEach(date => {
      if (trackedDates.has(date)) {
        active += 1;
        best = Math.max(best, active);
      } else {
        active = 0;
      }
    });

    res.json({
      current,
      best,
      trackedDates: Array.from(trackedDates).sort(),
      retention: 'forever'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/profile-stats', auth, async (req, res) => {
  try {
    const today = parseDate(req.query.today) || new Date();
    const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    const monthEnd = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + 1, 0));
    const daysInMonth = monthEnd.getUTCDate();
    const monthDates = eachDate(monthStart, monthEnd);
    const yearDates = eachDate(addDays(today, -365), today);

    const [user, profile, monthlyFoods, monthlyExercises, allFoods, allExercises] = await Promise.all([
      prisma.user.findUnique({ where: { id: req.user.id }, select: { created_at: true } }),
      prisma.profile.findUnique({ where: { user_id: req.user.id } }),
      prisma.foodLog.findMany({ where: { user_id: req.user.id, date: { in: monthDates } } }),
      prisma.exerciseLog.findMany({ where: { user_id: req.user.id, date: { in: monthDates } } }),
      prisma.foodLog.findMany({ where: { user_id: req.user.id, date: { in: yearDates } } }),
      prisma.exerciseLog.findMany({ where: { user_id: req.user.id, date: { in: yearDates } } })
    ]);

    const trackedDates = new Set([...allFoods, ...allExercises].map(log => log.date));
    let currentStreak = 0;
    for (let day = new Date(today); day >= addDays(today, -365); day = addDays(day, -1)) {
      if (!trackedDates.has(formatDate(day))) break;
      currentStreak += 1;
    }

    const monthlyTrackedDates = new Set([...monthlyFoods, ...monthlyExercises].map(log => log.date));
    const foodByDate = new Map();
    allFoods.forEach(food => {
      const current = foodByDate.get(food.date) || { calories: 0, protein: 0 };
      current.calories += Number(food.calories || 0);
      current.protein += Number(food.protein_g || 0);
      foodByDate.set(food.date, current);
    });

    const exerciseByDate = new Map();
    allExercises.forEach(exercise => {
      exerciseByDate.set(exercise.date, (exerciseByDate.get(exercise.date) || 0) + Number(exercise.calories_burned || 0));
    });

    const monthlyCalories = monthlyFoods.reduce((sum, item) => sum + Number(item.calories || 0), 0);
    const monthlyProtein = monthlyFoods.reduce((sum, item) => sum + Number(item.protein_g || 0), 0);
    const daysLogged = monthlyTrackedDates.size;
    const avgCalories = daysLogged ? Math.round(monthlyCalories / daysLogged) : 0;
    const avgProtein = daysLogged ? Math.round(monthlyProtein / daysLogged) : 0;

    const proteinTarget = Number(profile?.protein_target || 0);
    const tdee = Number(profile?.tdee || 0);
    let proteinDays = 0;
    let calorieGoalDays = 0;
    yearDates.forEach(date => {
      const food = foodByDate.get(date) || { calories: 0, protein: 0 };
      const exerciseCalories = exerciseByDate.get(date) || 0;
      if (proteinTarget && food.protein >= proteinTarget) proteinDays += 1;
      if (tdee && food.calories > 0 && food.calories - exerciseCalories <= tdee) calorieGoalDays += 1;
    });

    const uniqueMeals = new Set(allFoods.map(food => String(food.food_name || '').trim().toLowerCase()).filter(Boolean)).size;
    const breakfastLogs = allFoods.filter(food => String(food.meal_type || '').toLowerCase() === 'breakfast').length;

    res.json({
      memberSince: user?.created_at || null,
      daysInMonth,
      daysLogged,
      avgCalories,
      avgProtein,
      currentStreak,
      totalFoodLogs: allFoods.length,
      totalExerciseLogs: allExercises.length,
      proteinDays,
      calorieGoalDays,
      uniqueMeals,
      breakfastLogs,
      achievements: {
        firstLog: allFoods.length > 0 || allExercises.length > 0,
        sevenDayStreak: currentStreak >= 7,
        proteinPro: proteinDays >= 5,
        consistent: currentStreak >= 30,
        muscleBuilder: allExercises.length >= 10,
        goalCrusher: calorieGoalDays >= 7,
        earlyBird: breakfastLogs >= 7,
        chefsPick: uniqueMeals >= 50
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
