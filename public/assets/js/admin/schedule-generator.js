// Maccabi SOC Admin Dashboard - Schedule Generation Functions
// Handles the complex scheduling algorithm and constraint management

const MAX_SHIFTS_PER_WEEK = 6; // Maximum 6 shifts per worker per week

// Shift priority order (1 = highest priority, 3 = lowest)
const SHIFT_PRIORITIES = {
    night: 1,    // Highest priority - critical security coverage
    morning: 2,  // High priority - essential for operations start
    evening: 3   // Lowest priority - day workers still present, can be left empty
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

            // Clear any previous schedule display
            document.getElementById('scheduleOutput').innerHTML = '';
            
            // Clear global schedule variables
            if (window.currentSchedule) {
                delete window.currentSchedule;
            }
            if (window.currentScheduleBeingGenerated) {
                delete window.currentScheduleBeingGenerated;
            }
            if (window.workerColorMap) {
                window.workerColorMap = {};
            }

            // Lock preferences during generation
            localStorage.setItem('preferencesLocked', 'true');
            localStorage.setItem('lockTimestamp', Date.now().toString());
            updateDisplay();

            // Calculate possible variations before generating
            const variations = this.calculatePossibleVariations(approvedSubmissions);

            // Show loading message
            showAlert('🔄 Generating multiple schedules to find best coverage...', 'info');

            // Generate multiple schedules and pick the best one
            const bestSchedule = this.generateBestCoverageSchedule(approvedSubmissions, variations);
            
            // Unlock preferences after generation (regardless of success/failure)
            localStorage.setItem('preferencesLocked', 'false');
            localStorage.setItem('lockTimestamp', '');
            updateDisplay();
            
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
            
            // Make sure to unlock preferences even if there's an error
            localStorage.setItem('preferencesLocked', 'false');
            localStorage.setItem('lockTimestamp', '');
            updateDisplay();
            
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
                console.log(`❌ 888 Pattern detected! Would create: [${sequence.join(', ')}] for ${workerName}`);
                console.log(`   Sequence spans shifts ${startShift}-${startShift + 4} (days ${Math.floor(startShift/3)}-${Math.floor((startShift+4)/3)})`);
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
            console.log(`🔄 Internal Attempt ${attempt}/${maxAttempts}...`);
            
            try {
                // Generate a fresh schedule for each attempt
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

            // Clear any existing global schedule and set new one
            if (window.currentScheduleBeingGenerated) {
                delete window.currentScheduleBeingGenerated;
            }
            window.currentScheduleBeingGenerated = schedule;

            // Initialize fresh worker stats for each generation attempt
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
            
            // Analyze empty shifts and provide strategic summary
            this.analyzeEmptyShifts(schedule);
            
            // FINAL VALIDATION: Check for any 888 patterns that might have slipped through
            this.validateNo888Patterns(schedule);
            
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
                
                // STRATEGIC PRIORITY ORDER: Fill critical shifts first, leave evening for last
                // Night shifts are most critical (security coverage)
                // Morning shifts are essential (operations start)  
                // Evening shifts can be left empty (day workers still present)
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
                            console.log(`✅ Assigned ${bestWorker.name} to ${shift} on day ${globalDay} (Priority: ${shift})`);
                        } else {
                            console.log(`⚠️ No suitable workers for ${shift} on day ${globalDay} after scoring`);
                        }
                    } else {
                        console.log(`❌ No available workers for ${shift} on day ${globalDay}`);
                    }
                });
            }
        });

        return coverage;
    },

    fillEmptyShifts: function(schedule, workers, workerStats, shiftTimes, isAggressivePass = false) {
        let filledCount = 0;
        const passName = isAggressivePass ? "AGGRESSIVE" : "FILL";
        const isSmallTeam = workers.length <= 4;
        
        console.log(`🔄 ${passName} PASS: Prioritizing night & morning shifts, evening shifts last`);
        if (isSmallTeam) {
            console.log(`👥 Small team detected (${workers.length} workers) - using flexible premium shift strategy`);
        }

        [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
            const weekStartDay = weekIndex * 7;

            for (let day = 0; day < 7; day++) {
                const globalDay = weekStartDay + day;
                // Same strategic priority: critical shifts first, evening last
                let shiftsByPriority = ['night', 'morning', 'evening'];
                
                // For small teams on Saturday, prioritize evening more to ensure weekend coverage
                if (isSmallTeam && day === 6) {
                    shiftsByPriority = ['night', 'morning', 'evening']; // Keep same but be more aggressive in scoring
                    console.log(`🎯 Saturday with small team - ensuring weekend evening coverage`);
                }

                shiftsByPriority.forEach(shift => {
                    if (week.days[day].shifts[shift]) return; // Already filled

                    const availableWorkers = workers.filter(worker => {
                        return this.isWorkerAvailableForFill(worker, shift, globalDay, week, workerStats, schedule);
                    });

                    if (availableWorkers.length > 0) {
                        // For small teams and Saturday evening, use different sorting
                        let selected;
                        if (isSmallTeam && day === 6 && shift === 'evening') {
                            // For Saturday evening with small teams, prefer workers with fewer premium shifts
                            const sorted = availableWorkers.sort((a, b) => {
                                const aPremium = workerStats[a.name]?.premiumShifts || 0;
                                const bPremium = workerStats[b.name]?.premiumShifts || 0;
                                const aTotal = workerStats[a.name]?.totalShifts || 0;
                                const bTotal = workerStats[b.name]?.totalShifts || 0;
                                
                                // First priority: fewer premium shifts
                                if (aPremium !== bPremium) return aPremium - bPremium;
                                // Second priority: fewer total shifts
                                return aTotal - bTotal;
                            });
                            selected = sorted[0];
                            console.log(`🎯 Saturday evening: Selected ${selected.name} (Premium: ${workerStats[selected.name]?.premiumShifts || 0}, Total: ${workerStats[selected.name]?.totalShifts || 0})`);
                        } else {
                            // Normal selection by total shifts
                            const sorted = availableWorkers.sort((a, b) =>
                                (workerStats[a.name]?.totalShifts || 0) - (workerStats[b.name]?.totalShifts || 0)
                            );
                            selected = sorted[0];
                        }
                        
                        this.assignWorkerToShift(selected, shift, day, globalDay, week, workerStats, shiftTimes);
                        filledCount++;
                        console.log(`✅ ${passName}: Filled ${shift} on day ${globalDay} with ${selected.name}`);
                    } else {
                        if (shift === 'evening') {
                            if (day === 6 && isSmallTeam) {
                                console.log(`⚠️ Could not fill Saturday evening with small team - may need more workers`);
                            } else {
                                console.log(`🎯 Strategic: Leaving ${shift} empty on day ${globalDay} (day workers present)`);
                            }
                        } else {
                            console.log(`⚠️ Unable to fill critical ${shift} shift on day ${globalDay}`);
                        }
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
        
        // Check weekly shift limit - ALWAYS maximum 6 shifts per week (legal/safety constraint)
        const shiftsThisWeek = this.countWorkerShiftsInWeek(worker.name, currentWeek, schedule);
        if (shiftsThisWeek >= MAX_SHIFTS_PER_WEEK) {
            return false;
        }
        
        // CRITICAL: Check for 888 pattern prevention in fill passes too!
        if (this.wouldCreate888Pattern(worker.name, globalDay, shift, schedule)) {
            console.log(`🚫 FILL PASS: Blocked ${worker.name} from ${shift} on day ${globalDay} - would create 888 pattern`);
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
        
        // Check weekly limit - ALWAYS maximum 6 shifts per week (legal/safety constraint)
        const shiftsThisWeek = this.countWorkerShiftsInWeek(worker.name, currentWeek, schedule);
        if (shiftsThisWeek >= MAX_SHIFTS_PER_WEEK) {
            return false;
        }
        
        // CRITICAL: Check for 888 pattern prevention
        if (this.wouldCreate888Pattern(worker.name, globalDay, shift, schedule)) {
            console.log(`🚫 MAIN PASS: Blocked ${worker.name} from ${shift} on day ${globalDay} - would create 888 pattern`);
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
        
        // Get total number of workers to adjust strategy for small teams
        const totalWorkers = Object.keys(allWorkerStats).length;
        const isSmallTeam = totalWorkers <= 4;
        
        // SHIFT TYPE PRIORITY BONUSES
        if (shift === 'night') {
            score += 50; // Highest priority - critical security coverage
            
            const currentWeek = Math.floor(globalDay / 7);
            const nightShiftsThisWeek = this.countNightShiftsInCurrentSchedule(worker.name, currentWeek, window.currentScheduleBeingGenerated);
            
            if (nightShiftsThisWeek >= 2) {
                return -1000; // Hard limit
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
            score += 30; // High priority - essential for operations
            
            const currentWeek = Math.floor(globalDay / 7);
            const morningShiftsThisWeek = this.countMorningShiftsInWeek(worker.name, currentWeek);
            
            if (morningShiftsThisWeek === 0) {
                score += 1000; // Very important to ensure morning coverage
                
                const dayInWeek = globalDay % 7;
                if (dayInWeek >= 4) {
                    score += 500; // Urgent if it's late in the week
                }
            } else {
                score -= morningShiftsThisWeek * 300;
            }
            
            if (stats.morningShifts === 0) {
                score += 200;
            }
        }
        
        if (shift === 'evening') {
            score -= 20; // Lower priority - can be left empty (day workers present)
            // BUT: Don't penalize as much for small teams to ensure better coverage
            if (isSmallTeam) {
                score += 10; // Reduce the penalty for small teams
            }
        }
        
        score -= stats.totalShifts * 5;
        
        const isPremiumShift = this.isPremiumWeekendShift(dayOfWeek, shift);
        if (isPremiumShift) {
            if (isSmallTeam) {
                // For small teams, be much more lenient with premium shift penalties
                score -= stats.premiumShifts * 8; // Reduced from 15 to 8
                if (stats.premiumShifts === 0) {
                    score += 35; // Increased bonus for first premium shift
                }
                
                // Special bonus for Saturday evening to ensure it gets filled
                if (dayOfWeek === 6 && shift === 'evening') {
                    score += 25;
                    console.log(`🎯 Small team bonus: +25 for Saturday evening to ${worker.name}`);
                }
            } else {
                // Normal premium shift handling for larger teams
                score -= stats.premiumShifts * 15;
                if (stats.premiumShifts === 0) {
                    score += 25;
                }
            }
        }
        
        if (dayOfWeek === 5 || dayOfWeek === 6) {
            // Reduced weekend penalty for small teams
            const weekendPenalty = isSmallTeam ? 4 : 8;
            score -= stats.weekendShifts * weekendPenalty;
        }
        
        if (stats.lastAssignedDay === globalDay - 1) {
            score -= 20;
        }
        
        // For small teams, increase randomization even more to ensure variation
        const randomFactor = isSmallTeam ? 75 : 50;
        return score + Math.random() * randomFactor;
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

    analyzeEmptyShifts: function(schedule) {
        console.log('📊 SOC EMPTY SHIFT ANALYSIS:');
        
        const totalWorkers = schedule.workers.length;
        const isSmallTeam = totalWorkers <= 4;
        
        let emptyShifts = {
            morning: [],
            evening: [],
            night: [],
            total: 0,
            saturdayEvening: false
        };

        [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
            week.days.forEach((day, dayIndex) => {
                const globalDay = weekIndex * 7 + dayIndex;
                
                ['morning', 'evening', 'night'].forEach(shift => {
                    if (!day.shifts[shift]) {
                        emptyShifts[shift].push({
                            week: weekIndex + 1,
                            day: day.dayShort,
                            date: day.dateStr,
                            globalDay: globalDay,
                            dayIndex: dayIndex
                        });
                        emptyShifts.total++;
                        
                        // Flag Saturday evening specifically
                        if (dayIndex === 6 && shift === 'evening') {
                            emptyShifts.saturdayEvening = true;
                        }
                    }
                });
            });
        });

        if (emptyShifts.total === 0) {
            console.log('✅ Perfect coverage! All 42 shifts filled.');
            return;
        }

        console.log(`📈 Coverage Summary: ${42 - emptyShifts.total}/42 shifts filled (${emptyShifts.total} empty)`);
        
        if (isSmallTeam) {
            console.log(`👥 Small team mode (${totalWorkers} workers) - using flexible constraints`);
        }
        
        if (emptyShifts.night.length > 0) {
            console.log(`🚨 CRITICAL: ${emptyShifts.night.length} night shifts empty:`, 
                emptyShifts.night.map(s => `${s.day} ${s.date}`).join(', '));
        }
        
        if (emptyShifts.morning.length > 0) {
            console.log(`⚠️ WARNING: ${emptyShifts.morning.length} morning shifts empty:`, 
                emptyShifts.morning.map(s => `${s.day} ${s.date}`).join(', '));
        }
        
        if (emptyShifts.evening.length > 0) {
            console.log(`🎯 STRATEGIC: ${emptyShifts.evening.length} evening shifts empty (day workers present):`, 
                emptyShifts.evening.map(s => `${s.day} ${s.date}`).join(', '));
        }

        // Special warning for Saturday evening with small teams
        if (emptyShifts.saturdayEvening && isSmallTeam) {
            console.log(`🎯 Saturday Evening Issue: With only ${totalWorkers} workers, Saturday evening coverage is challenging. Consider:`);
            console.log(`   • Adding more workers`);
            console.log(`   • Ensuring workers mark Saturday evening as available`);
            console.log(`   • Note: 6 shifts/week limit prevents overworking individual workers`);
        }

        // Calculate percentage by shift type
        const eveningPercent = (emptyShifts.evening.length / emptyShifts.total * 100).toFixed(1);
        const morningPercent = (emptyShifts.morning.length / emptyShifts.total * 100).toFixed(1);
        const nightPercent = (emptyShifts.night.length / emptyShifts.total * 100).toFixed(1);

        console.log(`📊 Empty shift distribution: Evening ${eveningPercent}%, Morning ${morningPercent}%, Night ${nightPercent}%`);
        
        if (emptyShifts.evening.length >= emptyShifts.morning.length + emptyShifts.night.length) {
            console.log('✅ Optimal strategy: Most empty shifts are evening (day workers can cover)');
        } else {
            console.log('⚠️ Suboptimal: Critical morning/night shifts empty - consider more workers');
        }
    },

    validateNo888Patterns: function(schedule) {
        console.log('🔍 FINAL VALIDATION: Checking for 888 patterns...');
        
        let patternsFound = [];
        
        // Create a flat array of all 42 shifts
        const allShifts = [];
        [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
            week.days.forEach((day, dayIndex) => {
                const globalDay = weekIndex * 7 + dayIndex;
                ['morning', 'evening', 'night'].forEach((shiftType, shiftTypeIndex) => {
                    allShifts.push({
                        worker: day.shifts[shiftType],
                        globalDay: globalDay,
                        shiftType: shiftType,
                        shiftIndex: globalDay * 3 + shiftTypeIndex,
                        dayName: day.dayShort,
                        date: day.dateStr
                    });
                });
            });
        });
        
        // Check every possible 5-shift sequence
        for (let startIndex = 0; startIndex <= 37; startIndex++) {
            const sequence = allShifts.slice(startIndex, startIndex + 5);
            const workers = sequence.map(s => s.worker);
            
            // Check each worker in the sequence
            const uniqueWorkers = [...new Set(workers.filter(w => w !== null))];
            uniqueWorkers.forEach(workerName => {
                if (this.is888Pattern(workers, workerName)) {
                    patternsFound.push({
                        worker: workerName,
                        sequence: workers,
                        shifts: sequence.map(s => `${s.dayName} ${s.shiftType}`),
                        startIndex: startIndex
                    });
                }
            });
        }
        
        if (patternsFound.length === 0) {
            console.log('✅ VALIDATION PASSED: No 888 patterns found in final schedule');
        } else {
            console.log(`🚨 VALIDATION FAILED: Found ${patternsFound.length} 888 patterns:`);
            patternsFound.forEach((pattern, index) => {
                console.log(`   ${index + 1}. ${pattern.worker}: [${pattern.sequence.join(', ')}]`);
                console.log(`      Shifts: ${pattern.shifts.join(' → ')}`);
            });
            console.log('⚠️ This indicates a bug in the 888 pattern prevention logic');
        }
        
        return patternsFound.length === 0;
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
