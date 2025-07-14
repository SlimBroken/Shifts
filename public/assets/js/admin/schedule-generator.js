// Maccabi SOC Admin Dashboard - Schedule Generation Functions
// Handles the complex scheduling algorithm and constraint management

const MAX_SHIFTS_PER_WEEK = 6; // Maximum 6 shifts per worker per week

// Shift priority order (1 = highest priority, 3 = lowest)
const SHIFT_PRIORITIES = {
    night: 1,    // Highest priority - critical coverage
    morning: 2,  // High priority - important for operations  
    evening: 3   // Lower priority - can be left empty if needed
};

const ScheduleGenerator = {

    generateSchedule: function() {
        try {
            console.log('🚀 Starting schedule generation...');
            
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
            
            if (!bestSchedule) {
                console.error('❌ Failed to generate schedule');
                showAlert('❌ Failed to generate schedule. Check console for errors.', 'danger');
                return;
            }
            
            ScheduleDisplay.displaySchedule(bestSchedule);
            
            showAlert(`✅ Best schedule found with ${bestSchedule.coverage.toFixed(1)}% coverage!`, 'success');
            
            console.log('✅ Schedule generation completed successfully');
            
        } catch (error) {
            console.error('❌ Error in schedule generation:', error);
            showAlert(`❌ Schedule generation failed: ${error.message}`, 'danger');
        }
    },

    // Function to check if assigning a worker would create an 888 pattern
wouldCreate888Pattern: function(workerName, globalDay, shift, schedule) {
    // Convert day and shift to absolute shift index (0-41 for 42 total shifts)
    const currentShiftIndex = globalDay * 3 + this.getShiftIndex(shift);
    
    // Check all possible 5-shift sequences that would include this assignment
    for (let startShift = Math.max(0, currentShiftIndex - 4); 
         startShift <= Math.min(37, currentShiftIndex); 
         startShift++) {
        
        // Create the 5-shift sequence
        const sequence = [];
        for (let i = 0; i < 5; i++) {
            const shiftIndex = startShift + i;
            const day = Math.floor(shiftIndex / 3);
            const shiftType = this.getShiftTypeFromIndex(shiftIndex % 3);
            
            if (shiftIndex === currentShiftIndex) {
                // This is the shift we're trying to assign
                sequence.push(workerName);
            } else {
                // Get the currently assigned worker for this shift
                const assignedWorker = this.getAssignedWorker(day, shiftType, schedule);
                sequence.push(assignedWorker);
            }
        }
        
        // Check if this sequence creates an 888 pattern for any worker
        if (this.is888Pattern(sequence, workerName)) {
            console.log(`❌ 888 Pattern detected! Would create: [${sequence.join(', ')}]`);
            return true;
        }
    }
    
    return false;
},

// Helper function to check if a sequence is an 888 pattern for a specific worker
is888Pattern: function(sequence, workerName) {
    // Pattern: Worker → Gap → Worker → Gap → Worker
    return sequence.length === 5 &&
           sequence[0] === workerName &&
           sequence[1] !== workerName && sequence[1] !== null &&
           sequence[2] === workerName &&
           sequence[3] !== workerName && sequence[3] !== null &&
           sequence[4] === workerName;
},

// Helper function to get shift index (0=morning, 1=evening, 2=night)
getShiftIndex: function(shift) {
    const shiftMap = { morning: 0, evening: 1, night: 2 };
    return shiftMap[shift];
},

// Helper function to get shift type from index
getShiftTypeFromIndex: function(index) {
    const shifts = ['morning', 'evening', 'night'];
    return shifts[index];
},

// Helper function to get currently assigned worker for a specific shift
getAssignedWorker: function(globalDay, shiftType, schedule) {
    const weekIndex = Math.floor(globalDay / 7);
    const dayIndex = globalDay % 7;
    
    let week;
    if (weekIndex === 0) {
        week = schedule.week1;
    } else if (weekIndex === 1) {
        week = schedule.week2;
    }
    
    if (!week || !week.days[dayIndex]) {
        return null;
    }
    
    return week.days[dayIndex].shifts[shiftType] || null;
},
    generateBestCoverageSchedule: function(submissions, variations) {
        console.log('🎯 SEARCHING FOR BEST COVERAGE SCHEDULE...');
        
        let bestSchedule = null;
        let bestCoverage = 0;
        const maxAttempts = 15;
        let attempt = 1;

        while (attempt <= maxAttempts) {
            console.log(`🔄 Attempt ${attempt}/${maxAttempts}...`);
            
            try {
                const schedule = this.generateOptimizedSchedule(submissions);
                
                if (!schedule) {
                    console.log(`❌ Attempt ${attempt} returned null schedule`);
                    attempt++;
                    continue;
                }
                
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
        try {
            // Validate that we have an active period
            const periodConfig = PeriodManagement.getCurrentPeriodConfig();
            if (!periodConfig || !periodConfig.isActive) {
                showAlert('❌ Cannot generate schedule: No active SOC period found. Please open a new period first.', 'danger');
                return null;
            }
            
            console.log('📅 SOC generating schedule for period:', periodConfig.label);
            
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

            // Clear any existing global schedule
            if (window.currentScheduleBeingGenerated) {
                delete window.currentScheduleBeingGenerated;
            }
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
            const totalPossibleShifts = 42;

            const shiftTimes = {
                morning: { start: 7, end: 15 },
                evening: { start: 15, end: 23 },
                night: { start: 23, end: 7 }
            };

            // PASS 1: Normal assignment with all constraints
            console.log('📋 SOC PASS 1: Initial assignment...');
            totalCoverage = this.performSchedulingPass(schedule, workers, workerStats, shiftTimes, 1);
            console.log(`✅ Pass 1: ${(totalCoverage / totalPossibleShifts * 100).toFixed(1)}% coverage`);

            // PASS 2: Fill empty shifts
            console.log('📋 SOC PASS 2: Filling empty shifts...');
            const pass2Filled = this.fillEmptyShifts(schedule, workers, workerStats, shiftTimes, false);
            totalCoverage += pass2Filled;
            console.log(`✅ Pass 2: +${pass2Filled} shifts, ${(totalCoverage / totalPossibleShifts * 100).toFixed(1)}% total`);

            // PASS 3: Final aggressive filling
            console.log('📋 SOC PASS 3: Aggressive filling...');
            const pass3Filled = this.fillEmptyShifts(schedule, workers, workerStats, shiftTimes, true);
            totalCoverage += pass3Filled;
            console.log(`✅ Pass 3: +${pass3Filled} shifts, ${(totalCoverage / totalPossibleShifts * 100).toFixed(1)}% final`);

            // Clean up global variable
            if (window.currentScheduleBeingGenerated) {
                delete window.currentScheduleBeingGenerated;
            }

            console.log('🎯 SOC SCHEDULE GENERATION COMPLETE!');
            return {
                ...schedule,
                coverage: (totalCoverage / totalPossibleShifts) * 100,
                totalAssignedShifts: totalCoverage,
                totalPossibleShifts: totalPossibleShifts,
                generatedAt: new Date().toISOString(),
                generatedBy: 'SOC Admin'
            };
            
        } catch (error) {
            console.error('❌ Error in generateOptimizedSchedule:', error);
            // Clean up on error
            if (window.currentScheduleBeingGenerated) {
                delete window.currentScheduleBeingGenerated;
            }
            return null;
        }
    },

    performSchedulingPass: function(schedule, workers, workerStats, shiftTimes, passNumber) {
        let coverage = 0;

        [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
            const weekStartDay = weekIndex * 7;
            
            for (let day = 0; day < 7; day++) {
                const globalDay = weekStartDay + day;
                
                // PRIORITY ORDER: night, morning, evening
                const shiftsByPriority = ['night', 'morning', 'evening'];
                
                shiftsByPriority.forEach(shift => {
                    if (week.days[day].shifts[shift]) {
                        coverage++;
                        return;
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
                const shiftsByPriority = ['night', 'morning', 'evening'];

                shiftsByPriority.forEach(shift => {
                    if (week.days[day].shifts[shift]) return;

                    const availableWorkers = workers.filter(worker => {
                        return this.isWorkerAvailableForFill(worker, shift, globalDay, week, workerStats, schedule);
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

    // Separate function for fill passes to avoid conflicts
    isWorkerAvailableForFill: function(worker, shift, globalDay, week, workerStats, schedule) {
        const currentWeek = Math.floor(globalDay / 7);
        const day = globalDay % 7;
        
        // Check weekly shift limit
        const shiftsThisWeek = this.countWorkerShiftsInWeek(worker.name, currentWeek, schedule);
        if (shiftsThisWeek >= MAX_SHIFTS_PER_WEEK) {
            return false;
        }
        
        // Check if worker wants this shift
        if (!worker.preferences[globalDay]?.[shift]) return false;

        // Check if already working this day
        const currentDayShifts = week.days[day].shifts;
        if (Object.values(currentDayShifts).includes(worker.name)) return false;

        // Night shift specific checks
        if (shift === 'night') {
            const nightShiftsThisWeek = this.countNightShiftsInCurrentSchedule(worker.name, currentWeek, schedule);
            if (nightShiftsThisWeek >= 2) return false;
        }

        return true;
    },

    isWorkerAvailable: function(worker, shift, day, globalDay, week, workerStats, shiftTimes, schedule) {
    const currentWeek = Math.floor(globalDay / 7);
    
    // Check weekly limit using consistent method
    const shiftsThisWeek = this.countWorkerShiftsInWeek(worker.name, currentWeek, schedule);
    if (shiftsThisWeek >= MAX_SHIFTS_PER_WEEK) {
        return false;
    }
    
    // NEW: Check for 888 pattern prevention
    if (this.wouldCreate888Pattern(worker.name, globalDay, shift, schedule)) {
        console.log(`🚫 Blocked ${worker.name} from ${shift} on day ${globalDay} - would create 888 pattern`);
        return false;
    }
    
    // Check availability
    if (!worker.preferences[globalDay] || !worker.preferences[globalDay][shift]) return false;

    // Check if already working this day
    const currentDayShifts = week.days[day].shifts;
    if (Object.values(currentDayShifts).includes(worker.name)) return false;

    // Night shift constraints
    if (shift === 'night') {
        const nightShiftsThisWeek = this.countNightShiftsInCurrentSchedule(worker.name, currentWeek, schedule);
        if (nightShiftsThisWeek >= 2) return false;

        // Avoid consecutive nights
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

    // Morning shift after night shift check
    if (shift === 'morning') {
        if (day > 0) {
            const prevDayShifts = week.days[day - 1]?.shifts || {};
            if (prevDayShifts.night === worker.name) return false;
        } else if (week === schedule.week2) {
            const prevWeekLastDayShifts = schedule.week1.days[6]?.shifts || {};
            if (prevWeekLastDayShifts.night === worker.name) return false;
        }
    }

    return true;
},

    // FIXED: Use consistent schedule parameter for all counting functions
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

    // Keep the other helper functions the same...
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
        stats.lastShiftEnd = this.calculateShiftEndTime(globalDay, shift, shiftTimes);
    },

    // ... rest of your helper functions stay the same
    calculatePossibleVariations: function(submissions) {
        console.log('🔢 CALCULATING POSSIBLE SCHEDULE VARIATIONS...');
        
        const workers = submissions.map(s => ({
            name: s.name,
            preferences: s.preferences
        }));

        let totalVariations = 1;
        let constrainedShifts = 0;
        let impossibleShifts = 0;

        for (let globalDay = 0; globalDay < 14; globalDay++) {
            ['morning', 'evening', 'night'].forEach(shift => {
                const availableWorkers = workers.filter(worker => {
                    return worker.preferences[globalDay] && worker.preferences[globalDay][shift];
                });

                if (availableWorkers.length === 0) {
                    impossibleShifts++;
                } else if (availableWorkers.length === 1) {
                    constrainedShifts++;
                } else {
                    totalVariations *= availableWorkers.length;
                    if (totalVariations > 1000000) {
                        totalVariations = 1000000;
                    }
                }
            });
        }

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
        
        if (shift === 'night') {
            const currentWeek = Math.floor(globalDay / 7);
            const nightShiftsThisWeek = this.countNightShiftsInCurrentSchedule(worker.name, currentWeek, window.currentScheduleBeingGenerated);
            
            if (nightShiftsThisWeek >= 2) {
                return -1000;
            }
            
            if (nightShiftsThisWeek === 1) {
                score -= 500;
            }
            
            score -= stats.nightShifts * 20;
            
            if (stats.nightShifts === 0) {
                score += 15;
            }
        }
        
        if (shift === 'morning') {
            const currentWeek = Math.floor(globalDay / 7);
            const morningShiftsThisWeek = this.countMorningShiftsInWeek(worker.name, currentWeek);
            
            if (morningShiftsThisWeek === 0) {
                score += 1000;
                
                const dayInWeek = globalDay % 7;
                if (dayInWeek >= 4) {
                    score += 500;
                }
            } else {
                score -= morningShiftsThisWeek * 300;
            }
            
            if (stats.morningShifts === 0) {
                score += 200;
            }
        }
        
        score -= stats.totalShifts * 5;
        
        const isPremiumShift = this.isPremiumWeekendShift(dayOfWeek, shift);
        if (isPremiumShift) {
            score -= stats.premiumShifts * 15;
            if (stats.premiumShifts === 0) {
                score += 25;
            }
        }
        
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            score -= stats.weekendShifts * 8;
        }
        
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

    calculateShiftStartTime: function(globalDay, shift, shiftTimes) {
        const baseDate = new Date(2025, 5, 1);
        const shiftDate = new Date(baseDate);
        shiftDate.setDate(baseDate.getDate() + globalDay);
        
        const startHour = shiftTimes[shift].start;
        shiftDate.setHours(startHour, 0, 0, 0);
        
        return shiftDate.getTime();
    },

    calculateShiftEndTime: function(globalDay, shift, shiftTimes) {
        const baseDate = new Date(2025, 5, 1);
        const shiftDate = new Date(baseDate);
        shiftDate.setDate(baseDate.getDate() + globalDay);
        
        const endHour = shiftTimes[shift].end;
        
        if (shift === 'night') {
            shiftDate.setDate(shiftDate.getDate() + 1);
            shiftDate.setHours(endHour, 0, 0, 0);
        } else {
            shiftDate.setHours(endHour, 0, 0, 0);
        }
        
        return shiftDate.getTime();
    }
};

// Global functions that need to be accessible from HTML
window.generateSchedule = ScheduleGenerator.generateSchedule.bind(ScheduleGenerator);
