// Maccabi SOC Admin Dashboard - Enhanced Schedule Generation Functions
// Handles complex scheduling algorithm with gap pattern optimization

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
            console.log('🚀 Starting enhanced schedule generation with gap optimization...');
            
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
            showAlert('🔄 Generating optimized schedules to minimize gap patterns...', 'info');

            // Generate multiple schedules and pick the best one
            const bestSchedule = this.generateBestOptimizedSchedule(approvedSubmissions, variations);
            
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
            
            const gapInfo = bestSchedule.gapAnalysis ? ` (${bestSchedule.gapAnalysis.totalSingleGaps} gap patterns)` : '';
            showAlert(`✅ Optimized schedule generated with ${bestSchedule.coverage.toFixed(1)}% coverage${gapInfo}!`, 'success');
            
            console.log('✅ Enhanced schedule generation completed successfully');
            
        } catch (error) {
            console.error('❌ Error in schedule generation:', error);
            
            // Make sure to unlock preferences even if there's an error
            localStorage.setItem('preferencesLocked', 'false');
            localStorage.setItem('lockTimestamp', '');
            updateDisplay();
            
            showAlert(`❌ Schedule generation failed: ${error.message}`, 'danger');
        }
    },


// NEW: Check if assigning a worker would create a single-shift gap
wouldCreateSingleShiftGap: function(workerName, globalDay, shift, schedule) {
    // Convert the current assignment to absolute shift index
    const currentShiftIndex = globalDay * 3 + this.getShiftIndex(shift);
    
    // Get all shifts this worker is currently assigned to
    const workerShifts = this.getWorkerAssignedShifts(workerName, schedule);
    
    // Check if any existing assignment is exactly 1 shift away
    for (const existingShiftIndex of workerShifts) {
        const shiftGap = Math.abs(currentShiftIndex - existingShiftIndex);
        
        // If there's exactly 1 shift between assignments (gap of 2 means 1 shift in between)
        if (shiftGap === 2) {
            console.log(`⚠️ SINGLE-SHIFT GAP: ${workerName} would work shift ${Math.min(currentShiftIndex, existingShiftIndex)} → 1 shift break → shift ${Math.max(currentShiftIndex, existingShiftIndex)}`);
            return true;
        }
    }
    
    return false;
},
    
   // NEW: Get all shift indices where a worker is assigned
getWorkerAssignedShifts: function(workerName, schedule) {
    const assignedShifts = [];
    
    [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
        week.days.forEach((day, dayIndex) => {
            const globalDay = weekIndex * 7 + dayIndex;
            
            ['morning', 'evening', 'night'].forEach((shiftType, shiftTypeIndex) => {
                if (day.shifts[shiftType] === workerName) {
                    const shiftIndex = globalDay * 3 + shiftTypeIndex;
                    assignedShifts.push(shiftIndex);
                }
            });
        });
    });
    
    return assignedShifts.sort((a, b) => a - b);
},

// NEW: Count how many single-shift gaps a worker has
countWorkerSingleShiftGaps: function(workerName, schedule) {
    const workerShifts = this.getWorkerAssignedShifts(workerName, schedule);
    let singleShiftGaps = 0;
    
    for (let i = 0; i < workerShifts.length - 1; i++) {
        const currentShift = workerShifts[i];
        const nextShift = workerShifts[i + 1];
        const shiftsInBetween = nextShift - currentShift - 1;
        
        // If there's exactly 1 shift in between (single-shift gap)
        if (shiftsInBetween === 1) {
            singleShiftGaps++;
            
            // Convert back to day/shift for logging
            const currentDay = Math.floor(currentShift / 3);
            const currentShiftType = this.getShiftTypeFromIndex(currentShift % 3);
            const nextDay = Math.floor(nextShift / 3);
            const nextShiftType = this.getShiftTypeFromIndex(nextShift % 3);
            
            console.log(`⚠️ Single-shift gap found: ${workerName} works ${currentDay} ${currentShiftType} → 1 shift break → ${nextDay} ${nextShiftType}`);
        }
    }
    
    return singleShiftGaps;
},
    
    generateBestOptimizedSchedule: function(submissions, variations) {
        console.log('🎯 SEARCHING FOR BEST OPTIMIZED SCHEDULE...');
        
        let bestSchedule = null;
        let bestCoverage = 0;
        let bestGapScore = Infinity; // Lower is better for gap patterns
        const maxAttempts = 20; // Increased attempts for optimization
        let attempt = 1;
        let perfectSchedules = []; // Store all 100% coverage schedules for comparison

        while (attempt <= maxAttempts) {
            console.log(`🔄 Optimization Attempt ${attempt}/${maxAttempts}...`);
            
            try {
                // Generate a fresh schedule for each attempt
                const schedule = this.generateOptimizedSchedule(submissions);
                
                if (!schedule) {
                    console.log(`❌ Attempt ${attempt} returned null schedule`);
                    attempt++;
                    continue;
                }
                
                console.log(`📊 Attempt ${attempt}: ${schedule.coverage.toFixed(1)}% coverage`);
                
                // If we found 100% coverage, analyze gap patterns
                if (schedule.coverage >= 100) {
                    const gapAnalysis = this.analyzeGapPatterns(schedule);
                    schedule.gapAnalysis = gapAnalysis;
                    
                    console.log(`🎯 PERFECT COVERAGE! Gap score: ${gapAnalysis.totalSingleGaps} single gaps, ${gapAnalysis.totalGapDays} gap days`);
                    
                    perfectSchedules.push({
                        schedule: schedule,
                        gapScore: gapAnalysis.totalSingleGaps,
                        attempt: attempt
                    });
                    
                    // If this is the first perfect schedule or has fewer gaps, it's our best so far
                    if (gapAnalysis.totalSingleGaps < bestGapScore) {
                        bestGapScore = gapAnalysis.totalSingleGaps;
                        bestSchedule = schedule;
                        console.log(`⭐ New best gap optimization: ${gapAnalysis.totalSingleGaps} single gaps`);
                    }
                    
                    // If we found a schedule with 0 single gaps, use it immediately
                    if (gapAnalysis.totalSingleGaps === 0) {
                        console.log(`🏆 PERFECT! Found schedule with 0 single gaps on attempt ${attempt}`);
                        break;
                    }
                } else {
                    // For non-perfect coverage, use the old logic
                    if (schedule.coverage > bestCoverage) {
                        bestCoverage = schedule.coverage;
                        bestSchedule = schedule;
                        console.log(`⭐ New best coverage: ${bestCoverage.toFixed(1)}%`);
                    }
                }
                
            } catch (error) {
                console.log(`❌ Attempt ${attempt} failed:`, error);
            }
            
            attempt++;
        }

        // Final selection logic
        if (perfectSchedules.length > 0) {
            // We have perfect coverage schedules, pick the one with fewest gaps
            const bestPerfect = perfectSchedules.reduce((best, current) => 
                current.gapScore < best.gapScore ? current : best
            );
            
            bestSchedule = bestPerfect.schedule;
            bestSchedule.optimizationResult = {
                totalAttempts: maxAttempts,
                perfectSchedules: perfectSchedules.length,
                selectedAttempt: bestPerfect.attempt,
                finalGapScore: bestPerfect.gapScore
            };
            
            console.log(`🏆 FINAL SELECTION: Attempt ${bestPerfect.attempt} with ${bestPerfect.gapScore} single gaps`);
            console.log(`📊 Had ${perfectSchedules.length} perfect coverage options to choose from`);
        }

        // Add metadata to the best schedule found
        if (bestSchedule) {
            bestSchedule.variations = variations;
            bestSchedule.attemptNumber = bestSchedule.optimizationResult ? 
                `Optimized (${bestSchedule.optimizationResult.selectedAttempt}/${maxAttempts})` : 
                `Best of ${maxAttempts}`;
            bestSchedule.totalAttempts = maxAttempts;
            
            if (bestSchedule.coverage >= 100) {
                console.log(`🎯 OPTIMIZATION COMPLETE: ${bestSchedule.coverage.toFixed(1)}% coverage with ${bestSchedule.gapAnalysis?.totalSingleGaps || 'unknown'} single gaps`);
            } else {
                console.log(`🏆 BEST RESULT: ${bestSchedule.coverage.toFixed(1)}% coverage (unable to achieve 100%)`);
            }
        }

        return bestSchedule;
    },

   // ENHANCED: Better analysis showing shift gaps
analyzeGapPatterns: function(schedule) {
    console.log('🔍 ANALYZING SINGLE-SHIFT GAP PATTERNS...');
    
    const analysis = {
        singleShiftGaps: [],
        totalSingleShiftGaps: 0,
        workerShiftGapCounts: {}
    };
    
    schedule.workers.forEach(worker => {
        analysis.workerShiftGapCounts[worker] = 0;
        const workerShifts = this.getWorkerAssignedShifts(worker, schedule);
        
        for (let i = 0; i < workerShifts.length - 1; i++) {
            const shiftsInBetween = workerShifts[i + 1] - workerShifts[i] - 1;
            
            if (shiftsInBetween === 1) {
                analysis.totalSingleShiftGaps++;
                analysis.workerShiftGapCounts[worker]++;
                
                const shift1Day = Math.floor(workerShifts[i] / 3);
                const shift1Type = this.getShiftTypeFromIndex(workerShifts[i] % 3);
                const shift2Day = Math.floor(workerShifts[i + 1] / 3);
                const shift2Type = this.getShiftTypeFromIndex(workerShifts[i + 1] % 3);
                
                console.log(`⚠️ ${worker}: Day ${shift1Day} ${shift1Type} → 8hr break → Day ${shift2Day} ${shift2Type}`);
            }
        }
    });
    
    if (analysis.totalSingleShiftGaps === 0) {
        console.log('✅ EXCELLENT: No single-shift gaps found!');
    } else {
        console.log(`⚠️ Found ${analysis.totalSingleShiftGaps} single-shift gaps (8-hour breaks)`);
        
        // Show worst offenders
        const workersByGaps = Object.entries(analysis.workerShiftGapCounts)
            .filter(([worker, count]) => count > 0)
            .sort(([,a], [,b]) => b - a);
        
        workersByGaps.forEach(([worker, count]) => {
            console.log(`   👤 ${worker}: ${count} single-shift gaps`);
        });
    }
    
    return analysis;
}

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

    // Helper function to check if worker worked on a specific day
    workerWorkedOnDay: function(workerName, globalDay, schedule) {
        if (globalDay < 0 || globalDay > 13) return false;
        
        const weekIndex = Math.floor(globalDay / 7);
        const dayIndex = globalDay % 7;
        const week = weekIndex === 0 ? schedule.week1 : schedule.week2;
        
        if (!week || !week.days[dayIndex]) return false;
        
        const shifts = week.days[dayIndex].shifts;
        return Object.values(shifts).includes(workerName);
    },

    // NEW: Calculate penalty for patterns that would create single gaps
    calculateGapPatternPenalty: function(workerName, globalDay, schedule) {
        let penalty = 0;
        
        if (!schedule) return 0;
        
        // Check if assigning this worker to this day would create single gaps
        const workerDays = this.getWorkerAssignedDays(workerName, schedule);
        
        // Check for potential single gaps before and after this assignment
        for (const assignedDay of workerDays) {
            const dayDiff = Math.abs(globalDay - assignedDay);
            
            // If there would be exactly 1 day gap, apply penalty
            if (dayDiff === 2) { // 2 days apart means 1 day gap in between
                penalty += 30; // Moderate penalty for single gaps
            }
        }
        
        return penalty;
    },

    // Helper: Get all days where a worker is currently assigned
    getWorkerAssignedDays: function(workerName, schedule) {
        const assignedDays = [];
        
        [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
            week.days.forEach((day, dayIndex) => {
                const globalDay = weekIndex * 7 + dayIndex;
                
                if (day.shifts.morning === workerName || 
                    day.shifts.evening === workerName || 
                    day.shifts.night === workerName) {
                    assignedDays.push(globalDay);
                }
            });
        });
        
        return assignedDays;
    },

    // BALANCED: Prevent specific 888 patterns while allowing good coverage
    wouldCreateAnyGapPattern: function(workerName, globalDay, schedule) {
        // Strategy: Allow gaps, but prevent the specific problematic 888 pattern:
        // Worker → Gap → Worker → Gap → Worker (in any 5-day window)
        
        // Check all possible 5-day windows that include this assignment
        for (let windowStart = Math.max(0, globalDay - 4); windowStart <= Math.min(9, globalDay); windowStart++) {
            const windowEnd = windowStart + 4;
            
            // Build the 5-day sequence
            const sequence = [];
            for (let day = windowStart; day <= windowEnd; day++) {
                if (day === globalDay) {
                    sequence.push(workerName); // This is the assignment we're testing
                } else {
                    sequence.push(this.workerWorkedOnDay(workerName, day, schedule) ? workerName : null);
                }
            }
            
            // Check if this sequence creates the specific 888 pattern
            if (this.is888Pattern(sequence, workerName)) {
                console.log(`🚫 888 PATTERN BLOCKED: ${workerName} would create [${sequence.join(', ')}] in days ${windowStart}-${windowEnd}`);
                return true;
            }
        }
        
        // Additional check: Prevent more than 2 assignments in any 3-day window 
        // (this prevents excessive clustering while allowing flexibility)
        if (globalDay >= 1 && globalDay <= 12) {
            const dayBefore = globalDay - 1;
            const dayAfter = globalDay + 1;
            
            let assignmentsIn3Days = 1; // Count today's assignment
            if (this.workerWorkedOnDay(workerName, dayBefore, schedule)) assignmentsIn3Days++;
            if (this.workerWorkedOnDay(workerName, dayAfter, schedule)) assignmentsIn3Days++;
            
            if (assignmentsIn3Days > 2) {
                console.log(`🚫 CLUSTERING BLOCKED: ${workerName} would have ${assignmentsIn3Days} assignments in 3-day window (max 2)`);
                return true;
            }
        }
        
        return false; // Allow this assignment
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
            
            // FINAL VALIDATION: Check for consecutive shift violations  
            this.validateNoConsecutiveShiftViolations(schedule);
            
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
    const totalShifts = 42;

    [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
        const weekStartDay = weekIndex * 7;
        
        for (let day = 0; day < 7; day++) {
            const globalDay = weekStartDay + day;
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
                    const currentCoveragePercent = (coverage / totalShifts) * 100;
                    
                    const scoredWorkers = availableWorkers.map(worker => ({
                        worker: worker,
                        score: this.calculateWorkerScore(worker, shift, day, globalDay, workerStats[worker.name], workerStats, currentCoveragePercent)
                    }))
                    .filter(sw => sw.score > -500)
                    .sort((a, b) => b.score - a.score);

                    if (scoredWorkers.length > 0) {
                        const bestWorker = scoredWorkers[0].worker;
                        this.assignWorkerToShift(bestWorker, shift, day, globalDay, week, workerStats, shiftTimes);
                        coverage++;
                        console.log(`✅ Assigned ${bestWorker.name} to ${shift} on day ${globalDay}`);
                    }
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
        
        // COMPREHENSIVE: Prevent ANY worker-gap-worker patterns that could lead to 888
        if (this.wouldCreateAnyGapPattern(worker.name, globalDay, schedule)) {
            console.log(`🚫 COMPREHENSIVE MAIN: Blocked ${worker.name} - would create worker-gap-worker pattern on day ${globalDay}`);
            return false;
        }
        
        // Check availability
        if (!worker.preferences[globalDay] || !worker.preferences[globalDay][shift]) return false;

        // Check if already working this day (one shift per day rule)
        const currentDayShifts = week.days[day].shifts;
        if (Object.values(currentDayShifts).includes(worker.name)) return false;

        // CRITICAL: Check 8-hour minimum break between consecutive shifts
        if (!this.hasMinimumBreakTime(worker.name, globalDay, shift, schedule)) {
            return false;
        }

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

        return true;
    },

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
        
        // COMPREHENSIVE: Prevent ANY worker-gap-worker patterns that could lead to 888
        if (this.wouldCreateAnyGapPattern(worker.name, globalDay, schedule)) {
            console.log(`🚫 COMPREHENSIVE FILL: Blocked ${worker.name} - would create worker-gap-worker pattern on day ${globalDay}`);
            return false;
        }
        
        // Check if worker wants this shift
        if (!worker.preferences[globalDay]?.[shift]) return false;

        // Check if already working this day (one shift per day rule)
        const currentDayShifts = week.days[day].shifts;
        if (Object.values(currentDayShifts).includes(worker.name)) return false;

        // CRITICAL: Check 8-hour minimum break between consecutive shifts
        if (!this.hasMinimumBreakTime(worker.name, globalDay, shift, schedule)) {
            return false;
        }

        // Night shift specific checks
        if (shift === 'night') {
            const nightShiftsThisWeek = this.countNightShiftsInCurrentSchedule(worker.name, currentWeek, schedule);
            if (nightShiftsThisWeek >= 2) return false;
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

    // ENHANCED: Add shift-gap penalty to worker scoring
calculateWorkerScore: function(worker, shift, dayOfWeek, globalDay, stats, allWorkerStats, currentCoverage = 0) {
    let score = 100;
    const totalWorkers = Object.keys(allWorkerStats).length;
    const isSmallTeam = totalWorkers <= 4;
    
    // Standard scoring logic (keep existing)
    if (shift === 'night') {
        score += 50;
        const currentWeek = Math.floor(globalDay / 7);
        const nightShiftsThisWeek = this.countNightShiftsInCurrentSchedule(worker.name, currentWeek, window.currentScheduleBeingGenerated);
        if (nightShiftsThisWeek >= 2) return -1000;
        if (nightShiftsThisWeek === 1) score -= 500;
        score -= stats.nightShifts * 20;
        if (stats.nightShifts === 0) score += 15;
    }
    
    if (shift === 'morning') {
        score += 30;
        const currentWeek = Math.floor(globalDay / 7);
        const morningShiftsThisWeek = this.countMorningShiftsInWeek(worker.name, currentWeek);
        if (morningShiftsThisWeek === 0) {
            score += 1000;
            const dayInWeek = globalDay % 7;
            if (dayInWeek >= 4) score += 500;
        } else {
            score -= morningShiftsThisWeek * 300;
        }
        if (stats.morningShifts === 0) score += 200;
    }
    
    if (shift === 'evening') {
        score -= 20;
        if (isSmallTeam) score += 10;
    }
    
    score -= stats.totalShifts * 5;
    
    const isPremiumShift = this.isPremiumWeekendShift(dayOfWeek, shift);
    if (isPremiumShift) {
        if (isSmallTeam) {
            score -= stats.premiumShifts * 8;
            if (stats.premiumShifts === 0) score += 35;
            if (dayOfWeek === 6 && shift === 'evening') score += 25;
        } else {
            score -= stats.premiumShifts * 15;
            if (stats.premiumShifts === 0) score += 25;
        }
    }
    
    if (dayOfWeek === 5 || dayOfWeek === 6) {
        const weekendPenalty = isSmallTeam ? 4 : 8;
        score -= stats.weekendShifts * weekendPenalty;
    }
    
    if (stats.lastAssignedDay === globalDay - 1) score -= 20;
    
    // 🚨 NEW: SINGLE-SHIFT GAP PREVENTION
    if (currentCoverage >= 80) {
        // Massive penalty when coverage is high
        if (this.wouldCreateSingleShiftGap(worker.name, globalDay, shift, window.currentScheduleBeingGenerated)) {
            score -= 800;
            console.log(`🚨 BLOCKED single-shift gap for ${worker.name}`);
        }
        
        // Extra penalty for workers who already have gaps
        const existingGaps = this.countWorkerSingleShiftGaps(worker.name, window.currentScheduleBeingGenerated);
        if (existingGaps > 0) {
            score -= existingGaps * 200;
        }
    } else if (currentCoverage >= 60) {
        // Moderate penalty when coverage is decent
        if (this.wouldCreateSingleShiftGap(worker.name, globalDay, shift, window.currentScheduleBeingGenerated)) {
            score -= 300;
        }
    }
    
    const randomFactor = isSmallTeam ? 75 : 50;
    return score + Math.random() * randomFactor;
},


    // NEW: Calculate current coverage percentage
calculateCurrentCoverage: function(schedule) {
    if (!schedule) return 0;
    
    let filledShifts = 0;
    const totalShifts = 42;
    
    [schedule.week1, schedule.week2].forEach(week => {
        week.days.forEach(day => {
            if (day.shifts.morning) filledShifts++;
            if (day.shifts.evening) filledShifts++;
            if (day.shifts.night) filledShifts++;
        });
    });
    
    return (filledShifts / totalShifts) * 100;
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

    hasMinimumBreakTime: function(workerName, globalDay, shift, schedule) {
        // Check if worker had a shift yesterday that would violate 8-hour break rule
        
        // Get previous day's shifts
        let prevDayShifts = null;
        
        if (globalDay > 0) {
            const prevGlobalDay = globalDay - 1;
            const prevWeekIndex = Math.floor(prevGlobalDay / 7);
            const prevDayIndex = prevGlobalDay % 7;
            
            let prevWeek;
            if (prevWeekIndex === 0) {
                prevWeek = schedule.week1;
            } else if (prevWeekIndex === 1) {
                prevWeek = schedule.week2;
            }
            
            if (prevWeek && prevWeek.days[prevDayIndex]) {
                prevDayShifts = prevWeek.days[prevDayIndex].shifts;
            }
        }
        
        if (!prevDayShifts) return true; // No previous day to check
        
        // Check each possible previous shift
        for (const [prevShiftType, prevWorker] of Object.entries(prevDayShifts)) {
            if (prevWorker === workerName) {
                // Found worker had a shift yesterday, check if current assignment violates break rule
                if (!this.isValidShiftTransition(prevShiftType, shift)) {
                    console.log(`⏰ BREAK VIOLATION: ${workerName} - ${prevShiftType} yesterday → ${shift} today violates 8-hour break rule`);
                    return false;
                }
            }
        }
        
        return true;
    },

    isValidShiftTransition: function(prevShift, currentShift) {
        // Shift times: Morning 07:00-15:00, Evening 15:00-23:00, Night 23:00-07:00+1
        
        // The only problematic transition is: Night → Morning (same day)
        // Night ends at 07:00, Morning starts at 07:00 = 0 hours break
        if (prevShift === 'night' && currentShift === 'morning') {
            return false; // 0 hours break - VIOLATION
        }
        
        // All other transitions are OK:
        // Night → Evening: Night ends 07:00, Evening starts 15:00 = 8 hours break ✅
        // Evening → Morning: Evening ends 23:00, Morning starts 07:00 next day = 8 hours break ✅  
        // Morning → Any: Morning ends 15:00, next shift starts next day = 16+ hours break ✅
        
        return true;
    },

    calculateBreakHours: function(prevShift, currentShift) {
        // Simplified break calculation for logging purposes
        if (prevShift === 'night' && currentShift === 'morning') {
            return 0; // Night ends 07:00, Morning starts 07:00
        }
        if (prevShift === 'night' && currentShift === 'evening') {
            return 8; // Night ends 07:00, Evening starts 15:00
        }
        if (prevShift === 'evening' && currentShift === 'morning') {
            return 8; // Evening ends 23:00, Morning starts 07:00 next day
        }
        if (prevShift === 'morning') {
            return 16; // Morning ends 15:00, next shift starts next day minimum 07:00
        }
        
        return 24; // Default safe value
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

    validateNoConsecutiveShiftViolations: function(schedule) {
        console.log('⏰ FINAL VALIDATION: Checking for consecutive shift violations...');
        
        let violationsFound = [];
        
        // Create flat array of all shifts with worker assignments
        const allShifts = [];
        [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
            week.days.forEach((day, dayIndex) => {
                const globalDay = weekIndex * 7 + dayIndex;
                ['morning', 'evening', 'night'].forEach((shiftType) => {
                    allShifts.push({
                        worker: day.shifts[shiftType],
                        globalDay: globalDay,
                        shiftType: shiftType,
                        dayName: day.dayShort,
                        date: day.dateStr,
                        weekIndex: weekIndex,
                        dayIndex: dayIndex
                    });
                });
            });
        });
        
        // Check each shift against the next day's shifts
        for (let i = 0; i < allShifts.length; i++) {
            const currentShift = allShifts[i];
            if (!currentShift.worker) continue; // Skip empty shifts
            
            // Check next day's shifts (3 shifts later in the array)
            const nextDayStartIndex = (currentShift.globalDay + 1) * 3;
            
            for (let j = nextDayStartIndex; j < nextDayStartIndex + 3 && j < allShifts.length; j++) {
                const nextDayShift = allShifts[j];
                
                if (nextDayShift.worker === currentShift.worker) {
                    // Same worker has shifts on consecutive days - check if it violates break rule
                    if (!this.isValidShiftTransition(currentShift.shiftType, nextDayShift.shiftType)) {
                        violationsFound.push({
                            worker: currentShift.worker,
                            firstShift: `${currentShift.dayName} ${currentShift.date} ${currentShift.shiftType}`,
                            secondShift: `${nextDayShift.dayName} ${nextDayShift.date} ${nextDayShift.shiftType}`,
                            breakHours: this.calculateBreakHours(currentShift.shiftType, nextDayShift.shiftType)
                        });
                    }
                }
            }
        }
        
        if (violationsFound.length === 0) {
            console.log('✅ VALIDATION PASSED: No consecutive shift violations found');
        } else {
            console.log(`🚨 VALIDATION FAILED: Found ${violationsFound.length} consecutive shift violations:`);
            violationsFound.forEach((violation, index) => {
                console.log(`   ${index + 1}. ${violation.worker}: ${violation.firstShift} → ${violation.secondShift} (${violation.breakHours} hours break)`);
            });
            console.log('⚠️ This indicates a bug in the break time prevention logic');
        }
        
        return violationsFound.length === 0;
    }
};

// Global functions that need to be accessible from HTML
window.generateSchedule = ScheduleGenerator.generateSchedule.bind(ScheduleGenerator);
