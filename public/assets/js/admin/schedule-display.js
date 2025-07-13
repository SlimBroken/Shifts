// Maccabi SOC Admin Dashboard - Schedule Display & Export Functions
// Handles schedule visualization, statistics, and Excel export

const ScheduleDisplay = {

    displaySchedule: function(schedule) {
    // Reset color mapping for new schedule to ensure consistency
    window.workerColorMap = {};
    
    // Log shift distribution for debugging
    this.logShiftDistribution(schedule);
        
        let html = `
            <div style="margin-top: 30px;">
                <h4>📊 לוח משמרות שנוצר (כיסוי: ${schedule.coverage.toFixed(1)}%)</h4>
                <div style="margin: 10px 0; padding: 15px; background: linear-gradient(135deg, #e8f5e8 0%, #f0fff0 100%); border-radius: 8px; border: 2px solid #4caf50;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 15px;">
                        <div style="display: flex; align-items: center; gap: 15px;">
                            <div style="display: flex; align-items: center; gap: 10px;">
                                <span style="font-size: 24px;">🎲</span>
                                <div>
                                    <div style="font-weight: bold; color: #2e7d32; font-size: 18px;">
                                        ${schedule.variations ? schedule.variations.estimated : 'N/A'} אפשרויות
                                    </div>
                                    <div style="font-size: 12px; color: #558b2f;">
                                        לוחות זמנים שונים אפשריים
                                    </div>
                                </div>
                            </div>
                            ${schedule.attemptNumber ? `
                                <div style="display: flex; align-items: center; gap: 10px;">
                                    <span style="font-size: 20px;">🎯</span>
                                    <div>
                                        <div style="font-weight: bold; color: #1976d2; font-size: 16px;">
                                            ${schedule.coverage >= 100 ? 'מושלם!' : 'הטוב ביותר'}
                                        </div>
                                        <div style="font-size: 12px; color: #1565c0;">
                                            ${schedule.attemptNumber} מתוך ${schedule.totalAttempts} ניסיונות
                                        </div>
                                    </div>
                                </div>
                            ` : ''}
                        </div>
                        <button class="btn" onclick="ScheduleDisplay.copyScheduleToExcel()" style="margin: 0;">📋 העתק לאקסל</button>
                    </div>
                    ${schedule.variations ? `
                        <div style="margin-top: 10px; font-size: 11px; color: #666; text-align: center;">
                            ${schedule.variations.constrainedShifts} משמרות מוגבלות • ${schedule.variations.impossibleShifts} משמרות בלתי אפשריות
                            ${schedule.coverage >= 100 ? ' • 🏆 כיסוי מושלם הושג!' : ''}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;

        // Week 1
        html += this.createWeekTable(1, schedule.week1, schedule.workers);
        html += this.createWeekStats('שבוע 1', schedule.week1, schedule.workers);
        
        // Week 2
        html += this.createWeekTable(2, schedule.week2, schedule.workers);
        html += this.createWeekStats('שבוע 2', schedule.week2, schedule.workers);

        document.getElementById('scheduleOutput').innerHTML = html;
        
        // Store for Excel export
        window.currentSchedule = schedule;
        
        console.log('📋 SOC schedule display completed');
    },

    createWeekTable: function(weekNumber, week, workers = []) {
        // Generate dynamic title based on actual dates
        const periodConfig = PeriodManagement.getCurrentPeriodConfig();
        let title = `שבוע ${weekNumber}`;
        
        if (periodConfig && week.days && week.days.length > 0) {
            const firstDay = week.days[0];
            const lastDay = week.days[week.days.length - 1];
            
            // Get the actual year from the period
            const periodStartDate = new Date(periodConfig.startDate);
            const year = periodStartDate.getFullYear();
            
            title = `שבוע SOC ${weekNumber} (${firstDay.dateStr} - ${lastDay.dateStr}, ${year})`;
        }
        
        let html = `
            <div style="margin: 30px 0;">
                <h5 style="color: #e2e8f0; margin-bottom: 20px; font-size: 18px; text-align: center;">
                    <span class="security-icon">📅</span> ${title}
                </h5>
                <table style="width: 100%; border-collapse: collapse; background: rgba(255, 255, 255, 0.95); 
                              border: 2px solid #1e40af; font-family: Arial, sans-serif; direction: rtl; 
                              border-radius: 10px; overflow: hidden; box-shadow: 0 8px 20px rgba(0,0,0,0.1);">
                    <thead>
                        <tr style="background: linear-gradient(135deg, #1e40af 0%, #2563eb 100%);">
                            <th style="border: 1px solid #1e40af; padding: 12px; text-align: center; 
                                       color: white; font-weight: bold; min-width: 90px;">משמרת</th>
        `;
        
        // Day headers - Sunday to Saturday (RTL)
        week.days.forEach((day, index) => {
            const isPremium = day.dayShort === 'שישי' || day.dayShort === 'שבת';
            const bgColor = isPremium ? 'linear-gradient(135deg, #d97706 0%, #f59e0b 100%)' : 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)';
            
            html += `<th style="border: 1px solid #1e40af; padding: 12px; text-align: center; 
                               background: ${bgColor}; color: white; font-weight: bold; min-width: 110px;">
                <div style="font-size: 14px; margin-bottom: 4px;">${day.dayShort}</div>
                <div style="font-size: 12px; opacity: 0.9;">${day.dateStr}</div>
                ${isPremium ? '<div style="font-size: 10px; margin-top: 2px;">💰 פרמיום</div>' : ''}
            </th>`;
        });
        
        html += '</tr></thead><tbody>';
        
        // Shift rows with Hebrew names and icons
        const shifts = [
            { key: 'morning', label: 'בוקר', time: '07-15', icon: '🌅' },
            { key: 'evening', label: 'ערב', time: '15-23', icon: '🌆' },
            { key: 'night', label: 'לילה', time: '23-07', icon: '🌙' }
        ];
        
        shifts.forEach((shift, shiftIndex) => {
            html += '<tr>';
            
            // Shift label column
            html += `<td style="border: 1px solid #1e40af; padding: 14px; text-align: center; 
                               background: linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%); 
                               font-weight: bold; font-size: 14px; color: #1e40af;">
                <div style="margin-bottom: 2px;">${shift.icon} ${shift.label}</div>
                <div style="font-size: 11px; color: #64748b; margin-top: 3px;">${shift.time}</div>
            </td>`;
            
            // Worker assignments for each day
            week.days.forEach(day => {
                const assignment = day.shifts[shift.key];
                
                if (assignment) {
                    const workerColor = this.getWorkerColor(assignment, workers);
                    html += `<td style="border: 1px solid #1e40af; padding: 14px; text-align: center; 
                                       height: 55px; background: ${workerColor}; font-weight: bold; 
                                       font-size: 14px; color: white; text-shadow: 1px 1px 2px rgba(0,0,0,0.3);">
                        ${assignment}
                    </td>`;
                } else {
                    html += `<td style="border: 1px solid #1e40af; padding: 14px; text-align: center; 
                                       height: 55px; background: linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%); 
                                       font-style: italic; color: #64748b; font-size: 13px;">
                        לא מוקצה
                    </td>`;
                }
            });
            
            html += '</tr>';
        });
        
        html += '</tbody></table></div>';
        return html;
    },

    createWeekStats: function(weekTitle, week, workers) {
        const workerShiftCounts = {};
        const workerPremiumCounts = {};
        const workerMorningCounts = {};
        const workerNightCounts = {};
        
        workers.forEach(worker => {
            workerShiftCounts[worker] = 0;
            workerPremiumCounts[worker] = 0;
            workerMorningCounts[worker] = 0;
            workerNightCounts[worker] = 0;
        });
        
        week.days.forEach((day, dayIndex) => {
            ['morning', 'evening', 'night'].forEach(shiftType => {
                const assignedWorker = day.shifts[shiftType];
                if (assignedWorker && workers.includes(assignedWorker)) {
                    workerShiftCounts[assignedWorker]++;
                    
                    if (shiftType === 'morning') {
                        workerMorningCounts[assignedWorker]++;
                    }
                    if (shiftType === 'night') {
                        workerNightCounts[assignedWorker]++;
                    }
                    
                    if (ScheduleGenerator.isPremiumWeekendShift(dayIndex, shiftType)) {
                        workerPremiumCounts[assignedWorker]++;
                    }
                }
            });
        });

        let html = `
            <div style="margin: 25px 0; padding: 25px; background: linear-gradient(135deg, rgba(255, 255, 255, 0.1) 0%, rgba(147, 197, 253, 0.05) 100%); border-radius: 15px; border: 2px solid rgba(147, 197, 253, 0.3);">
                <h5 style="color: #93c5fd; margin-bottom: 20px; text-align: center; font-size: 1.2em;">
                    <span class="security-icon">📈</span> סיכום משמרות SOC ${weekTitle}
                </h5>
                <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 20px;">
        `;

        const sortedWorkers = workers.sort((a, b) => workerShiftCounts[b] - workerShiftCounts[a]);

        sortedWorkers.forEach(worker => {
            const totalShifts = workerShiftCounts[worker];
            const premiumShifts = workerPremiumCounts[worker];
            const morningShifts = workerMorningCounts[worker];
            const nightShifts = workerNightCounts[worker];
            const workerColor = this.getWorkerColor(worker, workers);
            
            html += `
                <div style="background: rgba(255, 255, 255, 0.15); padding: 18px; border-radius: 12px; 
                            box-shadow: 0 4px 8px rgba(0,0,0,0.1); border-right: 4px solid ${workerColor}; 
                            transition: all 0.3s ease; backdrop-filter: blur(10px);"
                     onmouseover="this.style.transform='translateY(-3px)'; this.style.boxShadow='0 8px 20px rgba(0,0,0,0.2)'" 
                     onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 8px rgba(0,0,0,0.1)'">
                    <div style="font-weight: bold; color: #e2e8f0; margin-bottom: 10px; font-size: 16px;">
                        <span class="security-icon">👤</span> ${worker}
                    </div>
                    <div style="color: #dbeafe; font-size: 13px; line-height: 1.5;">
                        <div style="margin-bottom: 6px;">
                            <span style="color: #1a1a1a;">📊 סה"כ משמרות:</span> 
                            <strong style="color: #1a1a1a;">${totalShifts}</strong>
                        </div>
                        ${morningShifts > 0 ? `
                            <div style="margin-bottom: 6px; color: black;">
                                <span>🌅 בוקר:</span> 
                                <strong>${morningShifts}</strong>
                            </div>
                        ` : `
                            <div style="margin-bottom: 6px; color: black;">
                                <span>🌅 בוקר:</span> 
                                <strong style="color: #000000;">0 ⚠️</strong>
                            </div>
                        `}
                        ${nightShifts > 0 ? `
                            <div style="margin-bottom: 6px; color: black;">
                                <span>🌙 לילה:</span> 
                                <strong>${nightShifts}</strong>
                            </div>
                        ` : ''}
                        ${premiumShifts > 0 ? `
                            <div style="color: black;">
                                <span>💰 פרמיום:</span> 
                                <strong>${premiumShifts}</strong>
                            </div>
                        ` : ''}
                    </div>
                </div>
            `;
        });

        html += '</div></div>';
        return html;
    },

   getWorkerColor: function(workerName, workers) {
    // Create a global color mapping if it doesn't exist
    if (!window.workerColorMap) {
        window.workerColorMap = {};
    }
    
    // If this worker already has a color, return it
    if (window.workerColorMap[workerName]) {
        return window.workerColorMap[workerName];
    }
    
    // Color palette
    const colors = [
        '#FF6B6B', '#4ECDC4', '#96CEB4', '#FFEAA7', '#DDA0DD', 
        '#98D8C8', '#F7DC6F', '#BB8FCE', '#F8C471', '#82E0AA', 
        '#F1948A', '#B19CD9', '#FFB347', '#DEB887', '#F0E68C', 
        '#FFE4E1', '#FFA07A', '#98FB98', '#F5DEB3', '#FFB6C1',
        '#DA70D6', '#FF69B4', '#32CD32', '#FFD700', '#FF4500',
        '#DC143C', '#00CED1', '#9370DB', '#FF1493', '#00FF7F'
    ];
    
    // Assign color based on worker's index in the workers array
    const workerIndex = workers.indexOf(workerName);
    const color = colors[workerIndex % colors.length];
    
    // Store the color mapping for future use
    window.workerColorMap[workerName] = color;
    
    return color;
},

    copyScheduleToExcel: function() {
        if (!window.currentSchedule) {
            showAlert('❌ No SOC schedule to copy!', 'warning');
            return;
        }

        const periodConfig = PeriodManagement.getCurrentPeriodConfig();
        const periodLabel = periodConfig ? periodConfig.label : 'Unknown Period';
        
        let excelText = `לוח משמרות SOC - ${periodLabel}\n`;
        excelText += `נוצר ב${new Date().toLocaleDateString('he-IL')} | כיסוי: ${window.currentSchedule.coverage.toFixed(1)}%\n`;
        excelText += `מערכת ניהול SOC | מכבי\n\n`;
        
        excelText += 'שבוע 1\n';
        excelText += this.generateWeekExcelFormat(window.currentSchedule.week1);
        excelText += '\n';
        
        excelText += 'שבוע 2\n';
        excelText += this.generateWeekExcelFormat(window.currentSchedule.week2);

        navigator.clipboard.writeText(excelText).then(() => {
            showAlert('✅ SOC schedule copied to clipboard! You can paste it directly into Excel.', 'success');
            console.log('📋 SOC schedule exported to clipboard');
        }).catch(() => {
            showAlert('❌ Copy failed. Please try again.', 'warning');
        });
    },

    generateWeekExcelFormat: function(week) {
        let text = '';
        
        // Header row - shift names first, then days (left to right)
        text += 'משמרת\t';
        for (let i = 0; i < week.days.length; i++) {
            const day = week.days[i];
            text += `${day.dayShort} ${day.dateStr}\t`;
        }
        text += '\n';
        
        // Shift rows (left to right)
        const shifts = [
            { key: 'morning', label: 'בוקר (07:00-15:00)' },
            { key: 'evening', label: 'ערב (15:00-23:00)' },
            { key: 'night', label: 'לילה (23:00-07:00)' }
        ];
        
        shifts.forEach(shift => {
            // Shift name first (leftmost column)
            text += `${shift.label}\t`;
            
            // Then worker assignments for each day (left to right)
            for (let i = 0; i < week.days.length; i++) {
                const day = week.days[i];
                const assignment = day.shifts[shift.key];
                text += `${assignment || 'לא מוקצה'}\t`;
            }
            
            text += '\n';
        });
        
        return text;
    },

    logShiftDistribution: function(schedule) {
        console.log('=== SOC SHIFT DISTRIBUTION ANALYSIS ===');
        
        const workers = schedule.workers;
        const shiftCounts = {};
        
        // Initialize counts
        workers.forEach(worker => {
            shiftCounts[worker] = { 
                night: { week1: 0, week2: 0, total: 0 },
                morning: { week1: 0, week2: 0, total: 0 },
                total: { week1: 0, week2: 0, overall: 0 }
            };
        });
        
        // Count week 1
        schedule.week1.days.forEach((day, dayIndex) => {
            ['morning', 'evening', 'night'].forEach(shiftType => {
                const assignedWorker = day.shifts[shiftType];
                if (assignedWorker && workers.includes(assignedWorker)) {
                    shiftCounts[assignedWorker].total.week1++;
                    shiftCounts[assignedWorker].total.overall++;
                    
                    if (shiftType === 'night') {
                        shiftCounts[assignedWorker].night.week1++;
                        shiftCounts[assignedWorker].night.total++;
                    }
                    if (shiftType === 'morning') {
                        shiftCounts[assignedWorker].morning.week1++;
                        shiftCounts[assignedWorker].morning.total++;
                    }
                }
            });
        });
        
        // Count week 2
        schedule.week2.days.forEach((day, dayIndex) => {
            ['morning', 'evening', 'night'].forEach(shiftType => {
                const assignedWorker = day.shifts[shiftType];
                if (assignedWorker && workers.includes(assignedWorker)) {
                    shiftCounts[assignedWorker].total.week2++;
                    shiftCounts[assignedWorker].total.overall++;
                    
                    if (shiftType === 'night') {
                        shiftCounts[assignedWorker].night.week2++;
                        shiftCounts[assignedWorker].night.total++;
                    }
                    if (shiftType === 'morning') {
                        shiftCounts[assignedWorker].morning.week2++;
                        shiftCounts[assignedWorker].morning.total++;
                    }
                }
            });
        });
        
        // Log results
        console.log('📊 SOC TOTAL SHIFTS:');
        workers.forEach(worker => {
            const counts = shiftCounts[worker].total;
            console.log(`  ${worker}: Week1=${counts.week1} Week2=${counts.week2} Total=${counts.overall}`);
        });
        
        console.log('🌙 SOC NIGHT SHIFTS:');
        workers.forEach(worker => {
            const counts = shiftCounts[worker].night;
            const week1Status = counts.week1 <= 2 ? '✅' : '❌';
            const week2Status = counts.week2 <= 2 ? '✅' : '❌';
            console.log(`  ${worker}: Week1=${counts.week1}${week1Status} Week2=${counts.week2}${week2Status} Total=${counts.total}`);
        });
        
        console.log('🌅 SOC MORNING SHIFTS:');
        workers.forEach(worker => {
            const counts = shiftCounts[worker].morning;
            const week1Status = counts.week1 >= 1 ? '✅' : '❌';
            const week2Status = counts.week2 >= 1 ? '✅' : '❌';
            console.log(`  ${worker}: Week1=${counts.week1}${week1Status} Week2=${counts.week2}${week2Status} Total=${counts.total}`);
        });
        
        // Check violations
        const nightViolations = workers.filter(worker => 
            shiftCounts[worker].night.week1 > 2 || shiftCounts[worker].night.week2 > 2
        );
        
        const morningViolations = workers.filter(worker => 
            shiftCounts[worker].morning.week1 === 0 || shiftCounts[worker].morning.week2 === 0
        );
        
        if (nightViolations.length > 0) {
            console.log('⚠️ SOC NIGHT SHIFT VIOLATIONS:', nightViolations);
        } else {
            console.log('✅ SOC: All workers have ≤2 night shifts per week');
        }
        
        if (morningViolations.length > 0) {
            console.log('⚠️ SOC MISSING MORNING SHIFTS:', morningViolations);
        } else {
            console.log('✅ SOC: All workers have ≥1 morning shift per week');
        }
        
        // Count empty shifts
        let emptyShifts = 0;
        [schedule.week1, schedule.week2].forEach(week => {
            week.days.forEach(day => {
                ['morning', 'evening', 'night'].forEach(shift => {
                    if (!day.shifts[shift]) {
                        emptyShifts++;
                    }
                });
            });
        });
        
        console.log(`📈 SOC COVERAGE: ${42 - emptyShifts}/42 shifts filled (${((42 - emptyShifts) / 42 * 100).toFixed(1)}%)`);
        console.log(`❌ SOC EMPTY SHIFTS: ${emptyShifts}`);
        console.log('=== SOC ANALYSIS COMPLETE ===');
        
        return shiftCounts;
    }
};

// Global functions that need to be accessible from HTML
window.copyScheduleToExcel = ScheduleDisplay.copyScheduleToExcel.bind(ScheduleDisplay);
