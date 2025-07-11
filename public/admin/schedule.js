// schedule.js
// generateSchedule
function generateSchedule() {
            const approvedSubmissions = workerSubmissions.filter(s => s.approved);
            
            if (approvedSubmissions.length === 0) {
                showAlert('No approved submissions found. Please approve some submissions first.', 'warning');
                return;
            }

            localStorage.setItem('preferencesLocked', 'true');
            localStorage.setItem('lockTimestamp', Date.now().toString());
            updateDisplay();

            // Calculate possible variations before generating
            const variations = calculatePossibleVariations(approvedSubmissions);

            // Show loading message
            showAlert('🔄 Generating multiple schedules to find best coverage...', 'info');

            // Generate multiple schedules and pick the best one
            const bestSchedule = generateBestCoverageSchedule(approvedSubmissions, variations);
            
            displaySchedule(bestSchedule);
            
            showAlert(`✅ Best schedule found with ${bestSchedule.coverage.toFixed(1)}% coverage!`, 'success');
        }

        function generateBestCoverageSchedule(submissions, variations) {
            console.log('🎯 SEARCHING FOR BEST COVERAGE SCHEDULE...');
            
            let bestSchedule = null;
            let bestCoverage = 0;
            const maxAttempts = 15; // Try up to 15 different schedules
            let attempt = 1;

            while (attempt <= maxAttempts) {
                console.log(`🔄 Attempt ${attempt}/${maxAttempts}...`);
                
                try {
                    const schedule = generateOptimizedSchedule(submissions);
                    
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
        }

        function generateOptimizedSchedule(submissions) {
            const workers = submissions.map(s => ({
                name: s.name,
                preferences: s.preferences
            }));

            const schedule = {
                week1: initializeWeek(0),
                week2: initializeWeek(7),
                workers: workers.map(w => w.name)
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
            totalCoverage = performSchedulingPass(schedule, workers, workerStats, shiftTimes, 1);

            // PASS 2: Fill empty shifts with relaxed morning constraint
            const pass2Filled = fillEmptyShifts(schedule, workers, workerStats, shiftTimes, false);
            totalCoverage += pass2Filled;

            // PASS 3: Final aggressive filling
            const pass3Filled = fillEmptyShifts(schedule, workers, workerStats, shiftTimes, true);
            totalCoverage += pass3Filled;

            delete window.currentScheduleBeingGenerated;

            return {
                ...schedule,
                coverage: (totalCoverage / totalPossibleShifts) * 100,
                totalAssignedShifts: totalCoverage,
                totalPossibleShifts: totalPossibleShifts
            };
        }

function generateOptimizedSchedule(submissions) {
    // Validate that we have an active period
    const periodConfig = getCurrentPeriodConfig();
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
        week1: initializeWeek(0),
        week2: initializeWeek(7),
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
    totalCoverage = performSchedulingPass(schedule, workers, workerStats, shiftTimes, 1);
    console.log(`✅ SOC Pass 1 complete. Coverage: ${(totalCoverage / totalPossibleShifts * 100).toFixed(1)}%`);

    // PASS 2: Fill empty shifts with relaxed morning constraint
    console.log('📋 SOC PASS 2: Filling empty shifts with relaxed morning constraint...');
    const pass2Filled = fillEmptyShifts(schedule, workers, workerStats, shiftTimes, false);
    totalCoverage += pass2Filled;
    console.log(`✅ SOC Pass 2 complete. Additional filled: ${pass2Filled}. Total coverage: ${(totalCoverage / totalPossibleShifts * 100).toFixed(1)}%`);

    // PASS 3: Final aggressive filling
    console.log('📋 SOC PASS 3: Final aggressive filling with minimal constraints...');
    const pass3Filled = fillEmptyShifts(schedule, workers, workerStats, shiftTimes, true);
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
}
function analyzeEmptyShifts(schedule, workers, workerStats, shiftTimes) {
            console.log('🔍 ANALYZING WHY SHIFTS ARE EMPTY...');
            
            let emptyShiftsAnalysis = [];

            [schedule.week1, schedule.week2].forEach((week, weekIndex) => {
                const weekStartDay = weekIndex * 7;
                
                for (let day = 0; day < 7; day++) {
                    const globalDay = weekStartDay + day;
                    
                    ['morning', 'evening', 'night'].forEach(shift => {
                        if (!week.days[day].shifts[shift]) {
                            // This shift is empty - let's analyze why
                            const analysis = {
                                globalDay,
                                weekIndex: weekIndex + 1,
                                dayName: week.days[day].dayShort,
                                shift,
                                reasons: []
                            };

                            console.log(`\n❌ EMPTY SHIFT: ${shift} on ${week.days[day].dayShort} (Day ${globalDay})`);

                            // Check each worker to see why they can't work this shift
                            workers.forEach(worker => {
                                const reasons = [];

                                // Check availability
                                if (!worker.preferences[globalDay] || !worker.preferences[globalDay][shift]) {
                                    reasons.push('Not available');
                                } else {
                                    // Check if worker already has a shift on this day
                                    const currentDayShifts = week.days[day].shifts;
                                    if (currentDayShifts.morning === worker.name || 
                                        currentDayShifts.evening === worker.name || 
                                        currentDayShifts.night === worker.name) {
                                        reasons.push('Already working this day');
                                    } else {
                                        // Check night shift limit
                                        if (shift === 'night') {
                                            const currentWeek = Math.floor(globalDay / 7);
                                            const nightShiftsThisWeek = countNightShiftsInCurrentSchedule(worker.name, currentWeek, schedule);
                                            if (nightShiftsThisWeek >= 2) {
                                                reasons.push(`Already has ${nightShiftsThisWeek} night shifts this week`);
                                            }
                                        }

                                        // Check consecutive days
                                        if (hasWorkedConsecutiveDays(worker.name, globalDay, 6)) {
                                            reasons.push('Would create 7+ consecutive days');
                                        }

                                        // Check 8-hour break
                                        const workerStat = workerStats[worker.name];
                                        if (workerStat && workerStat.lastShiftEnd !== null) {
                                            const currentShiftStart = calculateShiftStartTime(globalDay, shift, shiftTimes);
                                            const hoursSinceLastShift = (currentShiftStart - workerStat.lastShiftEnd) / (1000 * 60 * 60);
                                            
                                            if (hoursSinceLastShift < 8) {
                                                reasons.push(`Only ${hoursSinceLastShift.toFixed(1)} hours since last shift`);
                                            }
                                        }

                                        // Check cross-day conflicts
                                        if (globalDay > 0) {
                                            const previousGlobalDay = globalDay - 1;
                                            const previousWeekIndex = Math.floor(previousGlobalDay / 7);
                                            const previousDayIndex = previousGlobalDay % 7;
                                            
                                            let previousWeek;
                                            if (previousWeekIndex === 0) {
                                                previousWeek = schedule.week1;
                                            } else if (previousWeekIndex === 1) {
                                                previousWeek = schedule.week2;
                                            }
                                            
                                            if (previousWeek && previousWeek.days[previousDayIndex]) {
                                                const previousDayShifts = previousWeek.days[previousDayIndex].shifts;
                                                const currentShiftStart = calculateShiftStartTime(globalDay, shift, shiftTimes);
                                                
                                                for (const prevShift of ['morning', 'evening', 'night']) {
                                                    if (previousDayShifts[prevShift] === worker.name) {
                                                        const prevShiftEnd = calculateShiftEndTime(previousGlobalDay, prevShift, shiftTimes);
                                                        const hoursGap = (currentShiftStart - prevShiftEnd) / (1000 * 60 * 60);
                                                        
                                                        if (hoursGap < 8) {
                                                            reasons.push(`Only ${hoursGap.toFixed(1)} hours after ${prevShift} yesterday`);
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        if (reasons.length === 0) {
                                            reasons.push('✅ AVAILABLE - This is suspicious!');
                                        }
                                    }
                                }

                                console.log(`  ${worker.name}: ${reasons.join(', ')}`);
                                analysis.reasons.push({ worker: worker.name, constraints: reasons });
                            });

                            emptyShiftsAnalysis.push(analysis);
                        }
                    });
                }
            });

            console.log(`\n📊 SUMMARY: ${emptyShiftsAnalysis.length} empty shifts found`);
            
            // Count reasons
            const reasonCounts = {};
            emptyShiftsAnalysis.forEach(shift => {
                shift.reasons.forEach(workerReason => {
                    workerReason.constraints.forEach(constraint => {
                        reasonCounts[constraint] = (reasonCounts[constraint] || 0) + 1;
                    });
                });
            });

            console.log('\n📈 TOP BLOCKING REASONS:');
            Object.entries(reasonCounts)
                .sort(([,a], [,b]) => b - a)
                .slice(0, 10)
                .forEach(([reason, count]) => {
                    console.log(`  ${count}x: ${reason}`);
                });

            return emptyShiftsAnalysis;
        }
function performSchedulingPass(schedule, workers, workerStats, shiftTimes, passNumber) {
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
                    return isWorkerAvailable(worker, shift, day, globalDay, week, workerStats, shiftTimes, schedule);
                });

                if (availableWorkers.length > 0) {
                    const scoredWorkers = availableWorkers.map(worker => ({
                        worker: worker,
                        score: calculateWorkerScore(worker, shift, day, globalDay, workerStats[worker.name], workerStats)
                    }))
                    .filter(sw => sw.score > -500)
                    .sort((a, b) => b.score - a.score);

                    if (scoredWorkers.length > 0) {
                        const bestWorker = scoredWorkers[0].worker;
                        assignWorkerToShift(bestWorker, shift, day, globalDay, week, workerStats, shiftTimes);
                        coverage++;
                    }
                }
            });
        }
    });

    return coverage;
}
