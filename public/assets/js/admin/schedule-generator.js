// Maccabi SOC Admin Dashboard - Schedule Generation Functions
// Handles the complex scheduling algorithm and constraint management

const MAX_SHIFTS_PER_WEEK = 6; // Maximum 6 shifts per worker per week
const ScheduleGenerator = {
  
    generateSchedule: function() {
        const approvedSubmissions = workerSubmissions.filter(s => s.approved);
        
        if (approvedSubmissions.length === 0) {
            showAlert('No approved submissions found. Please approve some submissions first.', 'warning');
            return;
        }

        localStorage.setItem('preferencesLocked', 'true');
        localStorage.setItem('lockTimestamp', Date.now().toString());
        updateDisplay();

        // Calculate possible variations before generating
        const variations = this.calculatePossibleVariations(approvedSubmissions);

        // Show loading message
        showAlert('🔄 Generating multiple schedules to find best coverage...', 'info');

        // Generate multiple schedules and pick the best one
        const bestSchedule = this.generateBestCoverageSchedule(approvedSubmissions, variations);
        
        ScheduleDisplay.displaySchedule(bestSchedule);
        
        showAlert(`✅ Best schedule found with ${bestSchedule.coverage.toFixed(1)}% coverage!`, 'success');
    },

    generateBestCoverageSchedule: function(submissions, variations) {
        console.log('🎯 SEARCHING FOR BEST COVERAGE SCHEDULE...');
        
        let bestSchedule = null;
        let bestCoverage = 0;
        const maxAttempts = 15; // Try up to 15 different schedules
        let attempt = 1;

        while (attempt <= maxAttempts) {
            console.log(`🔄 Attempt ${attempt}/${maxAttempts}...`);
            
            try {
                const schedule = this.generateOptimizedSchedule(submissions);
                
                console.log(`📊 Attempt ${attempt}: ${schedule.coverage.toFixed(1)}% coverage`);
                
                // If we found 100% coverage, use it immediately
                if (schedule.coverage >= 100) {
                    console.log(`🎯 PERFECT! Found 100% coverage on attempt ${attempt}`);
                    schedule.variations = variations;
                    schedule.attemptNumber = attempt;
                    schedule.totalAttempts = maxAttempts;
                    return schedule;
                }
                
                // Otherwise, keep the best one so far
                if (schedule.coverage > bestCoverage) {
                    bestCoverage = schedule.coverage;
                    bestSchedule = schedule;
                    console.log(`⭐ New best: ${bestCoverage.toFixed(1)}% coverage`);
                }
                
            } catch (error) {
                console.log(`❌ Attempt ${attempt} failed:`, error);
            }
            
            attempt++;
        }

        // Add metadata to the best schedule found
        if (bestSchedule) {
            bestSchedule.variations = variations;
            bestSchedule.attemptNumber = "Best of " + maxAttempts;
            bestSchedule.totalAttempts = maxAttempts;
            console.log(`🏆 FINAL RESULT: Best coverage found was ${bestCoverage.toFixed(1)}%`);
        }

        return bestSchedule;
    },

    generateOptimizedSchedule: function(submissions) {
        // Validate that we have an active period
        const periodConfig = PeriodManagement.getCurrentPeriodConfig();
        if (!periodConfig || !periodConfig.isActive) {
            showAlert('❌ Cannot generate schedule: No active SOC period found. Please open a new period first.', 'danger');
            return null;
        }
        
        console.log('📅 SOC generating schedule for period:', periodConfig.label);
        console.log('📊 SOC period dates:', periodConfig.startDate, 'to', periodConfig.endDate);
        
        const workers = submissions.map(s => ({
            name: s.name,
            preferences: s.preferences
        }));

        const schedule = {
            week1: this.initializeWeek(0),
            week2: this.initializeWeek(7),
            workers: workers.map(w => w.name),
            periodInfo: {
                label: periodConfig.label,
                startDate: periodConfig.startDate,
                endDate: periodConfig.endDate
            }
        };

        window.currentScheduleBeingGenerated = schedule;

        const workerStats = {};
        workers.forEach(worker => {
            workerStats[worker.name] = {
                totalShifts: 0,
                nightShifts: 0,
                morningShifts: 0,
                weekendShifts: 0,
                premiumShifts: 0,
                lastAssignedDay: -1,
                lastShiftEnd: null
            };
        });

        let totalCoverage = 0;
        const totalPossibleShifts = 42; // 3 shifts × 7 days × 2 weeks

        const shiftTimes = {
            morning: { start: 7, end: 15 },
            evening: { start: 15, end: 23 },
            night: { start: 23, end: 7 }
        };

        // PASS 1: Normal assignment with all constraints
        console.log('📋 SOC PASS 1: Initial assignment with full constraints...');
        totalCoverage = this.performSchedulingPass(schedule, workers, workerStats, shiftTimes, 1);
        console.log(`✅ SOC Pass 1 complete. Coverage: ${(totalCoverage / totalPossibleShifts * 100).toFixed(1)}%`);

        // PASS 2: Fill empty shifts with relaxed morning constraint
        console.log('📋 SOC PASS 2: Filling empty shifts with relaxed morning constraint...');
        const pass2Filled = this.fillEmptyShifts(schedule, workers, workerStats, shiftTimes, false);
        totalCoverage += pass2Filled;
        console.log(`✅ SOC Pass 2 complete. Additional filled: ${pass2Filled}. Total coverage: ${(totalCoverage / totalPossibleShifts * 100).toFixed(1)}%`);

        // PASS 3: Final aggressive filling
        console.log('📋 SOC PASS 3: Final aggressive filling with minimal constraints...');
        const pass3Filled = this.fillEmptyShifts(schedule, workers, workerStats, shiftTimes, true);
        totalCoverage += pass3Filled;
        console.log(`✅ SOC Pass 3 complete. Additional filled: ${pass3Filled}. Final coverage: ${(totalCoverage / totalPossibleShifts * 100).toFixed(1)}%`);

        delete window.currentScheduleBeingGenerated;

        console.log('🎯 SOC SCHEDULE GENERATION COMPLETE!');
        return {
            ...schedule,
            coverage: (totalCoverage / totalPossibleShifts) * 100,
            totalAssignedShifts: totalCoverage,
            totalPossibleShifts: totalPossibleShifts,
            generatedAt: new Date().toISOString(),
            generatedBy: 'SOC Admin'
        };
    },

    performSchedulingPass: function(schedule, workers, workerStats, shiftTimes, passNumber) {
        let coverage = 0;

        [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
            const weekStartDay = weekIndex * 7;
            
            for (let day = 0; day < 7; day++) {
                const globalDay = weekStartDay + day;
                
                ['morning', 'evening', 'night'].forEach(shift => {
                    if (week.days[day].shifts[shift]) {
                        coverage++;
                        return; // Already assigned
                    }

                    const availableWorkers = workers.filter(worker => {
                        return this.isWorkerAvailable(worker, shift, day, globalDay, week, workerStats, shiftTimes, schedule);
                    });

                    if (availableWorkers.length > 0) {
                        const scoredWorkers = availableWorkers.map(worker => ({
                            worker: worker,
                            score: this.calculateWorkerScore(worker, shift, day, globalDay, workerStats[worker.name], workerStats)
                        }))
                        .filter(sw => sw.score > -500)
                        .sort((a, b) => b.score - a.score);

                        if (scoredWorkers.length > 0) {
                            const bestWorker = scoredWorkers[0].worker;
                            this.assignWorkerToShift(bestWorker, shift, day, globalDay, week, workerStats, shiftTimes);
                            coverage++;
                        }
                    }
                });
            }
        });

        return coverage;
    },

    fillEmptyShifts: function(schedule, workers, workerStats, shiftTimes, isAggressivePass = false) {
    let filledCount = 0;

    [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
        const weekStartDay = weekIndex * 7;

        for (let day = 0; day < 7; day++) {
            const globalDay = weekStartDay + day;

            ['morning', 'evening', 'night'].forEach(shift => {
                if (week.days[day].shifts[shift]) return;

                const availableWorkers = workers.filter(worker => {
                    // NEW: Check maximum shifts per week limit
                    const currentWeek = Math.floor(globalDay / 7);
                    const shiftsThisWeek = this.countWorkerShiftsInWeek(worker.name, currentWeek, schedule);
                    if (shiftsThisWeek >= MAX_SHIFTS_PER_WEEK) {
                        return false;
                    }
                    
                    if (!worker.preferences[globalDay]?.[shift]) return false;

                    const currentDayShifts = week.days[day].shifts;
                    if (Object.values(currentDayShifts).includes(worker.name)) return false;

                    if (shift === 'night') {
                        const nightShiftsThisWeek = this.countNightShiftsInCurrentSchedule(worker.name, currentWeek, schedule);
                        if (nightShiftsThisWeek >= 2) return false;

                        // Avoid 2 nights in a row
                        if (globalDay > 0) {
                            const prevDay = globalDay - 1;
                            const prevWeekIndex = Math.floor(prevDay / 7);
                            const prevDayIndex = prevDay % 7;
                            const prevWeek = prevWeekIndex === 0 ? schedule.week1 : schedule.week2;
                            const prevShifts = prevWeek?.days?.[prevDayIndex]?.shifts;

                            if (prevShifts && prevShifts.night === worker.name) {
                                return false;
                            }
                        }
                    }

                    return true;
                });

                if (availableWorkers.length > 0) {
                    const sorted = availableWorkers.sort((a, b) =>
                        (workerStats[a.name]?.totalShifts || 0) - (workerStats[b.name]?.totalShifts || 0)
                    );
                    const selected = sorted[0];
                    this.assignWorkerToShift(selected, shift, day, globalDay, week, workerStats, shiftTimes);
                    filledCount++;
                }
            });
        }
    });

    return filledCount;
},

   isWorkerAvailable: function(worker, shift, day, globalDay, week, workerStats, shiftTimes, schedule) {
    // NEW: Check maximum shifts per week limit
    const currentWeek = Math.floor(globalDay / 7);
    const shiftsThisWeek = this.countWorkerShiftsInWeek(worker.name, currentWeek, schedule);
    if (shiftsThisWeek >= MAX_SHIFTS_PER_WEEK) {
        console.log(`❌ ${worker.name} already has ${shiftsThisWeek} shifts in week ${currentWeek + 1} (max: ${MAX_SHIFTS_PER_WEEK})`);
        return false;
    }
    
    // Prevent night-to-morning double shift
    if (shift === 'morning') {
        if (day > 0) {
            const prevDayShifts = week.days[day - 1]?.shifts || {};
            if (prevDayShifts.night === worker.name) return false;
        } else if (week === schedule.week2) {
            const prevWeekLastDayShifts = schedule.week1.days[6]?.shifts || {};
            if (prevWeekLastDayShifts.night === worker.name) return false;
        }
    }

    if (!worker.preferences[globalDay] || !worker.preferences[globalDay][shift]) return false;

    const currentDayShifts = week.days[day].shifts;
    if (Object.values(currentDayShifts).includes(worker.name)) return false;

    // Max 2 night shifts per week
    if (shift === 'night') {
        const nightShiftsThisWeek = this.countNightShiftsInWeek(worker.name, currentWeek);
        if (nightShiftsThisWeek >= 2) return false;

        // Avoid two consecutive nights
        if (globalDay > 0) {
            const prevDay = globalDay - 1;
            const prevWeekIndex = Math.floor(prevDay / 7);
            const prevDayIndex = prevDay % 7;
            const prevWeek = prevWeekIndex === 0 ? schedule.week1 : schedule.week2;
            const prevShifts = prevWeek?.days?.[prevDayIndex]?.shifts;

            if (prevShifts && prevShifts.night === worker.name) {
                return false;
            }
        }
    }

    return true;
},

countWorkerShiftsInWeek: function(workerName, weekNumber, schedule) {
    let week;
    if (weekNumber === 0) {
        week = schedule.week1;
    } else if (weekNumber === 1) {
        week = schedule.week2;
    }
    
    if (!week) return 0;
    
    let shiftCount = 0;
    week.days.forEach(day => {
        if (day.shifts.morning === workerName) shiftCount++;
        if (day.shifts.evening === workerName) shiftCount++;
        if (day.shifts.night === workerName) shiftCount++;
    });
    
    return shiftCount;
},
  
    assignWorkerToShift: function(worker, shift, day, globalDay, week, workerStats, shiftTimes) {
        const existingShifts = week.days[day].shifts;
        if (Object.values(existingShifts).includes(worker.name)) {
            console.error(`❌ Worker ${worker.name} already assigned on day ${globalDay}!`);
            return;
        }

        week.days[day].shifts[shift] = worker.name;

        const stats = workerStats[worker.name];
        stats.totalShifts++;
        if (shift === 'night') stats.nightShifts++;
        if (shift === 'morning') stats.morningShifts++;
        if (day === 5 || day === 6) stats.weekendShifts++;
        
        if (this.isPremiumWeekendShift(day, shift)) {
            stats.premiumShifts++;
        }
        
        stats.lastAssignedDay = globalDay;
        
        // Update the last shift end time
        const shiftEndTime = this.calculateShiftEndTime(globalDay, shift, shiftTimes);
        stats.lastShiftEnd = shiftEndTime;
        
        const endDate = new Date(shiftEndTime);
        console.log(`✅ Assigned ${worker.name} to ${shift} on day ${globalDay}. Shift ends: ${endDate.toLocaleString()}`);
    },

    calculatePossibleVariations: function(submissions) {
        console.log('🔢 CALCULATING POSSIBLE SCHEDULE VARIATIONS...');
        
        const workers = submissions.map(s => ({
            name: s.name,
            preferences: s.preferences
        }));

        let totalVariations = 1;
        let constrainedShifts = 0;
        let impossibleShifts = 0;

        // Analyze each shift slot
        for (let globalDay = 0; globalDay < 14; globalDay++) {
            ['morning', 'evening', 'night'].forEach(shift => {
                // Count available workers for this specific shift
                const availableWorkers = workers.filter(worker => {
                    return worker.preferences[globalDay] && worker.preferences[globalDay][shift];
                });

                if (availableWorkers.length === 0) {
                    impossibleShifts++;
                } else if (availableWorkers.length === 1) {
                    constrainedShifts++;
                } else {
                    // Multiple workers available = variations possible
                    totalVariations *= availableWorkers.length;
                    
                    // Cap the calculation to prevent overflow
                    if (totalVariations > 1000000) {
                        totalVariations = 1000000;
                    }
                }
            });
        }

        console.log(`📊 Analysis: ${constrainedShifts} constrained shifts, ${impossibleShifts} impossible shifts`);
        
        // Estimate realistic variations considering constraints
        let estimatedVariations;
        if (totalVariations >= 1000000) {
            estimatedVariations = "1,000,000+";
        } else if (totalVariations >= 10000) {
            estimatedVariations = Math.round(totalVariations / 1000) + "K+";
        } else if (totalVariations >= 1000) {
            estimatedVariations = Math.round(totalVariations / 100) * 100 + "+";
        } else {
            estimatedVariations = totalVariations.toLocaleString();
        }

        return {
            estimated: estimatedVariations,
            raw: totalVariations,
            constrainedShifts: constrainedShifts,
            impossibleShifts: impossibleShifts
        };
    },

    // Helper functions
    initializeWeek: function(globalStartDay) {
        const week = { days: [] };
        
        const periodConfig = PeriodManagement.getCurrentPeriodConfig();
        if (!periodConfig) {
            console.error('No active SOC period found for schedule generation');
            return week;
        }
        
        const periodStartDate = new Date(periodConfig.startDate);
        const startDate = new Date(periodStartDate);
        startDate.setDate(periodStartDate.getDate() + globalStartDay);
        
        const hebrewDays = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי', 'שישי', 'שבת'];
        
        for (let i = 0; i < 7; i++) {
            const currentDate = new Date(startDate);
            currentDate.setDate(startDate.getDate() + i);
            
            week.days.push({
                dayShort: hebrewDays[currentDate.getDay()],
                dateStr: currentDate.toLocaleDateString('en-GB', { day: '2-digit', month: '2-digit' }),
                shifts: {
                    morning: null,
                    evening: null,
                    night: null
                }
            });
        }
        
        return week;
    },

    calculateWorkerScore: function(worker, shift, dayOfWeek, globalDay, stats, allWorkerStats) {
        let score = 100;
        
        // HARD CONSTRAINT: Maximum 2 night shifts per week
        if (shift === 'night') {
            const currentWeek = Math.floor(globalDay / 7);
            const nightShiftsThisWeek = this.countNightShiftsInWeek(worker.name, currentWeek);
            
            if (nightShiftsThisWeek >= 2) {
                return -1000; // Impossible score
            }
            
            if (nightShiftsThisWeek === 1) {
                score -= 500; // Heavy penalty
            }
            
            score -= stats.nightShifts * 20;
            
            if (stats.nightShifts === 0) {
                score += 15;
            }
        }
        
        // CRITICAL: Morning shift distribution - ensure everyone gets at least 1 per week
        if (shift === 'morning') {
            const currentWeek = Math.floor(globalDay / 7);
            const morningShiftsThisWeek = this.countMorningShiftsInWeek(worker.name, currentWeek);
            
            // HIGHEST PRIORITY: Workers with 0 morning shifts this week
            if (morningShiftsThisWeek === 0) {
                score += 1000; // Extremely high bonus
                
                // Extra bonus if we're later in the week (urgency increases)
                const dayInWeek = globalDay % 7;
                if (dayInWeek >= 4) { // Thursday onwards
                    score += 500; // Even higher priority
                }
            } else {
                // Heavily penalize workers who already have morning shifts this week
                score -= morningShiftsThisWeek * 300;
            }
            
            // Also consider overall morning shift balance
            if (stats.morningShifts === 0) {
                score += 200; // High bonus for workers with no morning shifts overall
            }
        }
        
        // Load balancing - prefer workers with fewer total shifts
        score -= stats.totalShifts * 5;
        
        // Premium weekend shifts distribution (Friday evening to Saturday evening)
        const isPremiumShift = this.isPremiumWeekendShift(dayOfWeek, shift);
        if (isPremiumShift) {
            score -= stats.premiumShifts * 15;
            if (stats.premiumShifts === 0) {
                score += 25;
            }
        }
        
        // Regular weekend consideration
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            score -= stats.weekendShifts * 8;
        }
        
        // Avoid consecutive days
        if (stats.lastAssignedDay === globalDay - 1) {
            score -= 20;
        }
        
        return score + Math.random() * 5;
    },

    isPremiumWeekendShift: function(dayOfWeek, shift) {
        if (dayOfWeek === 5 && (shift === 'evening' || shift === 'night')) {
            return true;
        }
        if (dayOfWeek === 6 && (shift === 'morning' || shift === 'evening')) {
            return true;
        }
        return false;
    },

    countNightShiftsInWeek: function(workerName, weekNumber) {
        let week;
        if (weekNumber === 0) {
            week = window.currentScheduleBeingGenerated?.week1;
        } else if (weekNumber === 1) {
            week = window.currentScheduleBeingGenerated?.week2;
        }
        
        if (!week) return 0;
        
        let nightShiftCount = 0;
        week.days.forEach(day => {
            if (day.shifts.night === workerName) {
                nightShiftCount++;
            }
        });
        
        return nightShiftCount;
    },

    countMorningShiftsInWeek: function(workerName, weekNumber) {
        let week;
        if (weekNumber === 0) {
            week = window.currentScheduleBeingGenerated?.week1;
        } else if (weekNumber === 1) {
            week = window.currentScheduleBeingGenerated?.week2;
        }
        
        if (!week) return 0;
        
        let morningShiftCount = 0;
        week.days.forEach(day => {
            if (day.shifts.morning === workerName) {
                morningShiftCount++;
            }
        });
        
        return morningShiftCount;
    },

    countNightShiftsInCurrentSchedule: function(workerName, weekNumber, schedule) {
        let week;
        if (weekNumber === 0) {
            week = schedule.week1;
        } else if (weekNumber === 1) {
            week = schedule.week2;
        }
        
        if (!week) return 0;
        
        let nightShiftCount = 0;
        week.days.forEach(day => {
            if (day.shifts.night === workerName) {
                nightShiftCount++;
            }
        });
        
        return nightShiftCount;
    },

    calculateShiftStartTime: function(globalDay, shift, shiftTimes) {
        const baseDate = new Date(2025, 5, 1); // June 1st, 2025
        const shiftDate = new Date(baseDate);
        shiftDate.setDate(baseDate.getDate() + globalDay);
        
        const startHour = shiftTimes[shift].start;
        shiftDate.setHours(startHour, 0, 0, 0);
        
        return shiftDate.getTime();
    },

    calculateShiftEndTime: function(globalDay, shift, shiftTimes) {
        const baseDate = new Date(2025, 5, 1); // June 1st, 2025
        const shiftDate = new Date(baseDate);
        shiftDate.setDate(baseDate.getDate() + globalDay);
        
        const endHour = shiftTimes[shift].end;
        
        if (shift === 'night') {
            // Night shift ends the next day at 07:00
            shiftDate.setDate(shiftDate.getDate() + 1);
            shiftDate.setHours(endHour, 0, 0, 0);
        } else {
            // Morning/Evening shifts end same day
            shiftDate.setHours(endHour, 0, 0, 0);
        }
        
        return shiftDate.getTime();
    }
};

// Global functions that need to be accessible from HTML
window.generateSchedule = ScheduleGenerator.generateSchedule.bind(ScheduleGenerator);
