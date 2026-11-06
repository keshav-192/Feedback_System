function initAnalytics() {
    try {
        const summaryCard = document.getElementById('summary-card');
        const totalResponsesEl = document.getElementById('total-responses');
        const chartsWrapper = document.getElementById('charts-wrapper');
        const loadingOverlay = document.getElementById('loading-overlay');
        const toggleModeBtn = document.getElementById('toggle-analysis-mode');
        const questionSelector = document.getElementById('question-selector');
        const questionSelectorContainer = document.getElementById('question-selector-container');

        // Defaulting to true as per user request to open question-wise analysis by default
        let isQuestionWiseMode = true;
        let currentData = null;
        let selectedQuestionToView = 'all';

        function hasQuestionResponses(q) {
            if (!q) return false;
            if (typeof q.total_answered === 'number' && q.total_answered > 0) return true;
            if (q.tallies && typeof q.tallies === 'object') {
                const sum = Object.values(q.tallies).reduce((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0);
                if (sum > 0) return true;
            }
            return false;
        }

        // --- Consolidated Analytics Session Logging ---
        let activeAnalyticsSession = null;

        function startFormSession(formId, formTitle) {
            if (activeAnalyticsSession && activeAnalyticsSession.formId != formId) {
                flushAnalyticsSession(`Switched to Form '${formTitle || formId}'`);
            }
            if (!activeAnalyticsSession || activeAnalyticsSession.formId != formId) {
                activeAnalyticsSession = {
                    formId: formId,
                    formTitle: formTitle || 'Unknown Form',
                    operations: ['Viewed Dashboard']
                };
            }
        }

        function recordAnalyticsOperation(opStr) {
            if (activeAnalyticsSession) {
                activeAnalyticsSession.operations.push(opStr);
            }
        }

        function flushAnalyticsSession(exitReason = 'Closed Dashboard') {
            if (!activeAnalyticsSession) return;

            const sess = activeAnalyticsSession;
            activeAnalyticsSession = null; // Clear immediately to prevent duplicates

            const formTitle = sess.formTitle || 'Unknown Form';
            const formId = sess.formId || '';
            const ops = sess.operations || [];

            let opsText = "";
            if (ops.length > 0) {
                opsText = "Operations: [" + ops.join(' -> ') + " -> " + exitReason + "]";
            } else {
                opsText = exitReason;
            }

            const logAction = `Analytics Session [Form: ${formTitle}${formId ? ' (ID: ' + formId + ')' : ''}]: ${opsText}`;

            try {
                fetch('log_admin_event.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: logAction }),
                    keepalive: true
                }).catch(e => console.error('Analytics session log error:', e));
            } catch (err) {
                console.error('Fetch error:', err);
            }
        }

        window.flushAnalyticsSession = flushAnalyticsSession;

        window.addEventListener('beforeunload', function() {
            flushAnalyticsSession('Closed Page/Reloaded');
        });


        if (toggleModeBtn) {
            toggleModeBtn.addEventListener('click', function () {
                isQuestionWiseMode = !isQuestionWiseMode;
                recordAnalyticsOperation(isQuestionWiseMode ? 'Switched to Question-Wise Analysis' : 'Switched to Grouped Analysis');
                if (isQuestionWiseMode) {
                    toggleModeBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"></path></svg> Grouped Analysis';
                    if (questionSelectorContainer && currentData && currentData.summary.total_responses > 0) {
                        questionSelectorContainer.style.display = 'flex';
                    }
                } else {
                    toggleModeBtn.innerHTML = '<svg width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"></path></svg> Question Wise Analysis';
                    if (questionSelectorContainer) {
                        questionSelectorContainer.style.display = 'none';
                        if (questionSelector) questionSelector.value = 'all';
                        selectedQuestionToView = 'all';
                    }
                }
                if (currentData) {
                    renderDashboard(currentData);
                }
            });
        }

        if (questionSelector) {
            questionSelector.addEventListener('change', function () {
                selectedQuestionToView = this.value;
                if (currentData) {
                    renderDashboard(currentData);
                }
            });
        }

        const statusSelector = document.getElementById('status-selector');
        let selectedStatusToView = 'all';
        if (statusSelector) {
            statusSelector.addEventListener('change', function () {
                selectedStatusToView = this.value;
                recordAnalyticsOperation(`Filtered Response Status: ${selectedStatusToView}`);
                if (currentData) {
                    renderDashboard(currentData);
                }
            });
        }

        // Global Chart.js defaults
        function applyChartDefaults() {
            if (typeof Chart !== 'undefined') {
                Chart.defaults.font.family = "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                Chart.defaults.color = '#64748b'; // text-secondary
                Chart.defaults.plugins.legend.labels.usePointStyle = true;
                Chart.defaults.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.9)';
                Chart.defaults.plugins.tooltip.padding = 12;
                Chart.defaults.plugins.tooltip.cornerRadius = 8;
                Chart.defaults.plugins.tooltip.titleFont = { size: 14, weight: 'bold' };
                Chart.defaults.plugins.tooltip.bodyFont = { size: 13 };
            }
        }
        applyChartDefaults();

        // Semantic Rating Tiers - 6 Distinct Chromatic Hues across the Color Wheel
        // Eliminates identical green clusters and guarantees zero duplicate colors on rating scales
        const semanticRatingColors = {
            tier1_highPos: { bg: '#86efac', border: '#16a34a' }, // Soft Emerald Green (Hue 142°)
            tier2_posPlus: { bg: '#93c5fd', border: '#2563eb' }, // Soft Sky Blue (Hue 210°)
            tier3_pos:     { bg: '#5eead4', border: '#0d9488' }, // Soft Mint Teal (Hue 175°)
            tier4_neu:     { bg: '#fde047', border: '#ca8a04' }, // Soft Warm Butter (Hue 48°)
            tier5_neg:     { bg: '#fdba74', border: '#ea580c' }, // Soft Peach Cantaloupe (Hue 30°)
            tier6_highNeg: { bg: '#fca5a5', border: '#dc2626' }  // Soft Coral Rose (Hue 5°)
        };

        function getSemanticColor(label) {
            if (!label) return null;
            let text = String(label).toLowerCase().trim();

            // Extract core term if written like "1 (Poor)", "5 (Excellent)", "1 - Poor", "5. Excellent"
            const parenMatch = text.match(/\((.*?)\)/);
            if (parenMatch) {
                text = parenMatch[1].trim();
            } else {
                text = text.replace(/^\d+[\s\-\.\)]+/, '').trim();
            }

            // Tier 1: Highest positive / Affirmative (Emerald Green)
            if (['excellent', 'strongly agree', 'highly effective', 'always available', 'frequently', 'very affordable', 'very secure', 'yes'].includes(text)) {
                return semanticRatingColors.tier1_highPos;
            }
            // Tier 2: Strong positive (Sky Blue) - Separates "Very Good" from "Good"!
            if (['very good', 'mostly available', 'often', 'very satisfied'].includes(text)) {
                return semanticRatingColors.tier2_posPlus;
            }
            // Tier 3: Moderate positive (Mint Teal)
            if (['good', 'agree', 'effective', 'satisfied', 'affordable', 'secure'].includes(text)) {
                return semanticRatingColors.tier3_pos;
            }
            // Tier 4: Neutral / Middle (Warm Butter Yellow)
            if (['average', 'neutral', 'satisfactory', 'moderately effective', 'somewhat satisfied', 'sometimes available', 'sometimes', 'moderately secure', 'not sure'].includes(text)) {
                return semanticRatingColors.tier4_neu;
            }
            // Tier 5: Moderate negative (Peach Cantaloupe)
            if (['below average', 'disagree', 'dissatisfied', 'limited availability', 'rarely', 'expensive', 'insecure'].includes(text)) {
                return semanticRatingColors.tier5_neg;
            }
            // Tier 6: Highest negative (Coral Rose)
            if (['poor', 'strongly disagree', 'ineffective', 'very dissatisfied', 'not satisfied', 'not available', 'never', 'very expensive', 'no'].includes(text)) {
                return semanticRatingColors.tier6_highNeg;
            }
            return null;
        }

        // Shared Categorization for Likert Rating Scales
        function categorizeLikertOptions(allOptions) {
            const scored = (allOptions || []).map(opt => {
                let text = String(opt).toLowerCase().trim();
                const clean = text.replace(/^\d+[\s\-\.\)]+/, '').replace(/\((.*?)\)/, '$1').trim();
                let score = 3;

                if (['excellent', 'strongly agree', 'highly effective', 'always available', 'frequently', 'very affordable', 'very secure'].some(k => clean.includes(k))) {
                    score = 5;
                } else if (['very good', 'often', 'very satisfied'].some(k => clean.includes(k))) {
                    score = 4.5;
                } else if (['good', 'agree', 'effective', 'satisfied', 'affordable', 'secure', 'yes'].some(k => clean.includes(k))) {
                    score = 4;
                } else if (['average', 'neutral', 'satisfactory', 'sometimes', 'moderately', 'not sure'].some(k => clean.includes(k))) {
                    score = 3;
                } else if (['below average', 'disagree', 'dissatisfied', 'rarely', 'somewhat dissatisfied', 'expensive'].some(k => clean.includes(k))) {
                    score = 2;
                } else if (['poor', 'strongly disagree', 'very poor', 'never', 'ineffective', 'very dissatisfied', 'not available', 'no'].some(k => clean.includes(k))) {
                    score = 1;
                } else {
                    const m = text.match(/^(\d+)/);
                    if (m) score = parseFloat(m[1]);
                }
                return { option: opt, score: score, clean: clean };
            });

            const uniqueScores = new Set(scored.map(s => s.score));
            const hasLikertPolarity = uniqueScores.size >= 2 && scored.some(s => s.score < 2.9) && scored.some(s => s.score > 3.1);

            // Sort ascending from lowest negative to highest positive
            scored.sort((a, b) => a.score - b.score);

            const negOptions = scored.filter(s => s.score < 2.9);
            const neuOptions = scored.filter(s => s.score >= 2.9 && s.score <= 3.1);
            const posOptions = scored.filter(s => s.score > 3.1);

            return { scored, hasLikertPolarity, negOptions, neuOptions, posOptions };
        }

        // Master Curated 60-Tone Universal Chromatic Pastel Palette
        // Handcrafted across all 12 sectors of the color wheel with 5 calibrated non-glare tint tiers.
        // Interleaved with coprime chromatic dispersion so adjacent slices come from opposite wheel quadrants.
        const UNIVERSAL_60_PASTEL_PALETTE = [
            // --- Cycle 1: Fundamental Chromatic Wheel (12 completely distinct hues) ---
            { bg: '#93c5fd', border: '#3b82f6' }, // 0: Sky Blue (210°)
            { bg: '#fca5a5', border: '#ef4444' }, // 1: Coral Red (5°)
            { bg: '#5eead4', border: '#14b8a6' }, // 2: Mint Teal (175°)
            { bg: '#fde047', border: '#eab308' }, // 3: Honey Amber (65°)
            { bg: '#c4b5fd', border: '#8b5cf6' }, // 4: Periwinkle Lavender (265°)
            { bg: '#86efac', border: '#22c55e' }, // 5: Spring Emerald (145°)
            { bg: '#f9a8d4', border: '#ec4899' }, // 6: Rose Blush (330°)
            { bg: '#fdba74', border: '#f97316' }, // 7: Peach Apricot (35°)
            { bg: '#67e8f9', border: '#06b6d4' }, // 8: Aquamarine (195°)
            { bg: '#d9f99d', border: '#65a30d' }, // 9: Lime Tea (95°)
            { bg: '#d8b4fe', border: '#a855f7' }, // 10: Lilac Violet (285°)
            { bg: '#fcd34d', border: '#f59e0b' }, // 11: Warm Apricot (50°)

            // --- Cycle 2: Soft Tints (Opposite dispersion with gentle lightness variance) ---
            { bg: '#7dd3fc', border: '#0284c7' }, // 12: Light Azure (200°)
            { bg: '#fda4af', border: '#e11d48' }, // 13: Strawberry Cream (350°)
            { bg: '#6ee7b7', border: '#059669' }, // 14: Soft Sage (160°)
            { bg: '#fef08a', border: '#ca8a04' }, // 15: Primrose Butter (75°)
            { bg: '#a78bfa', border: '#7c3aed' }, // 16: Soft Purple (260°)
            { bg: '#bbf7d0', border: '#16a34a' }, // 17: Soft Pistachio (135°)
            { bg: '#fbcfe8', border: '#db2777' }, // 18: Soft Orchid (320°)
            { bg: '#fed7aa', border: '#ea580c' }, // 19: Soft Cantaloupe (25°)
            { bg: '#a5f3fc', border: '#0891b2' }, // 20: Ice Cyan (185°)
            { bg: '#bef264', border: '#4d7c0f' }, // 21: Chartreuse Tea (85°)
            { bg: '#e9d5ff', border: '#9333ea' }, // 22: Heather Violet (290°)
            { bg: '#fde68a', border: '#d97706' }, // 23: Mellow Gold (45°)

            // --- Cycle 3: Feather Pastels (Subtle elegance for high density charts) ---
            { bg: '#bae6fd', border: '#0369a1' }, // 24: Cornflower Frost (205°)
            { bg: '#fecdd3', border: '#be123c' }, // 25: Blush Petal (355°)
            { bg: '#99f6e4', border: '#0f766e' }, // 26: Seafoam Mist (170°)
            { bg: '#fef9c3', border: '#a16207' }, // 27: Lemon Chiffon (70°)
            { bg: '#ddd6fe', border: '#6d28d9' }, // 28: Lavender Fog (270°)
            { bg: '#dcfce7', border: '#15803d' }, // 29: Celadon Mint (140°)
            { bg: '#fce7f3', border: '#be185d' }, // 30: Cotton Candy (325°)
            { bg: '#ffedd5', border: '#c2410c' }, // 31: Papaya Cream (20°)
            { bg: '#cffafe', border: '#0e7490' }, // 32: Arctic Cyan (190°)
            { bg: '#ecfccb', border: '#3f6212' }, // 33: Key Lime Mist (90°)
            { bg: '#ede9fe', border: '#5b21b6' }, // 34: Thistle Mauve (280°)
            { bg: '#fef3c7', border: '#b45309' }, // 35: Sand Dunes (40°)

            // --- Cycle 4: Modern Executive Accents (Distinct Slate/Hue hybrids) ---
            { bg: '#38bdf8', border: '#0284c7' }, // 36: Sky Vivid Pastel (198°)
            { bg: '#fb7185', border: '#e11d48' }, // 37: Coral Vivid Pastel (348°)
            { bg: '#34d399', border: '#059669' }, // 38: Jade Vivid Pastel (158°)
            { bg: '#facc15', border: '#ca8a04' }, // 39: Amber Vivid Pastel (52°)
            { bg: '#818cf8', border: '#4f46e5' }, // 40: Indigo Pastel (235°)
            { bg: '#4ade80', border: '#16a34a' }, // 41: Basil Green (130°)
            { bg: '#f472b6', border: '#db2777' }, // 42: Peony Pink (328°)
            { bg: '#fb923c', border: '#ea580c' }, // 43: Tangerine Pastel (28°)
            { bg: '#2dd4bf', border: '#0d9488' }, // 44: Turquoise Frost (172°)
            { bg: '#a3e635', border: '#65a30d' }, // 45: Sprout Green (82°)
            { bg: '#c084fc', border: '#9333ea' }, // 46: Wisteria Violet (278°)
            { bg: '#fbbf24', border: '#d97706' }, // 47: Sunburst Pastel (42°)

            // --- Cycle 5: Muted Slate-Pastels (Gentle neutral-tinted contrast) ---
            { bg: '#cbd5e1', border: '#64748b' }, // 48: Cool Slate (215°)
            { bg: '#e2e8f0', border: '#94a3b8' }, // 49: Mist Grey (210°)
            { bg: '#ccfbf1', border: '#115e59' }, // 50: Mint Ice (168°)
            { bg: '#f1f5f9', border: '#475569' }, // 51: Frost Slate (220°)
            { bg: '#e0e7ff', border: '#4338ca' }, // 52: Periwinkle Ice (232°)
            { bg: '#d1fae5', border: '#065f46' }, // 53: Spearmint (152°)
            { bg: '#fae8ff', border: '#86198f' }, // 54: Fuchsia Frost (295°)
            { bg: '#ffe4e6', border: '#9f1239' }, // 55: Dusty Rose Ice (352°)
            { bg: '#e0f2fe', border: '#0369a1' }, // 56: Glacier Blue (202°)
            { bg: '#fefce8', border: '#854d0e' }, // 57: Warm Butter Frost (58°)
            { bg: '#f3e8ff', border: '#6b21a8' }, // 58: Mulberry Mist (272°)
            { bg: '#f5f5f4', border: '#78716c' }  // 59: Warm Stone (30°)
        ];

        // Compatibility alias
        const EXECUTIVE_PASTEL_PALETTE = UNIVERSAL_60_PASTEL_PALETTE;

        // Universal Guaranteed Non-Duplicating Pastel Palette Generator
        // Handles any arbitrary number of options up to 60 (matrix) and > 60 (dynamic golden-angle)
        function getDistinctPastelPalette(count) {
            if (count <= UNIVERSAL_60_PASTEL_PALETTE.length) {
                return UNIVERSAL_60_PASTEL_PALETTE.slice(0, count);
            }
            // Infinite Scalability Fallback for count > 60:
            // Dynamic Golden Angle Spiral with interleaved 4-phase lightness & 3-phase saturation
            const palette = [];
            const goldenAngle = 137.508;
            for (let i = 0; i < count; i++) {
                const hue = Math.round((i * goldenAngle + 210) % 360);
                const lightness = 66 + ((i % 4) * 3); // 66%, 69%, 72%, 75%
                const saturation = 44 + ((i % 3) * 5); // 44%, 49%, 54%
                palette.push({
                    bg: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
                    border: `hsl(${hue}, ${saturation + 18}%, ${Math.max(35, lightness - 22)}%)`
                });
            }
            return palette;
        }

        // Backward compatibility helper
        function getDistinctProfessionalColors(count) {
            return getDistinctPastelPalette(count).map(p => p.bg);
        }

        function generateColorsForLabels(labels) {
            const backgroundColors = [];
            const borderColors = [];

            // 1. Check if all options are standard Likert / semantic rating scale options
            const semanticMatches = labels.map(l => getSemanticColor(l));
            const allSemantic = semanticMatches.length > 0 && semanticMatches.every(m => m !== null);

            if (allSemantic) {
                // Strict zero-duplication enforcement: ensure all assigned colors are unique
                const bgs = semanticMatches.map(m => m.bg);
                const hasNoDuplicates = (new Set(bgs)).size === labels.length;
                if (hasNoDuplicates) {
                    for (let i = 0; i < labels.length; i++) {
                        backgroundColors.push(semanticMatches[i].bg);
                        borderColors.push(semanticMatches[i].border);
                    }
                    return { backgroundColors, borderColors };
                }
            }

            // 2. Universal 60-Color Palette Matrix (up to 60 options, with dynamic fallback for > 60)
            const palette = getDistinctPastelPalette(labels.length);
            for (let i = 0; i < labels.length; i++) {
                backgroundColors.push(palette[i].bg);
                borderColors.push(palette[i].border);
            }
            return { backgroundColors, borderColors };
        }

        // Helper function to create an accessible data table for any question
        function createDataTable(labels, dataValues, totalCount, containerHeight = 340) {
            const tableWrap = document.createElement('div');
            tableWrap.className = 'chart-data-table-container';
            tableWrap.style.maxHeight = containerHeight + 'px'; // match canvas height exactly
            tableWrap.style.display = 'none';

            const table = document.createElement('table');
            table.className = 'chart-data-table';
            table.innerHTML = `
            <thead>
                <tr>
                    <th>Option / Answer</th>
                    <th style="text-align: right;">Responses</th>
                    <th style="text-align: right; width: 120px;">Percentage</th>
                </tr>
            </thead>
            <tbody>
                ${labels.map((lbl, i) => {
                const cnt = dataValues[i] || 0;
                const pct = totalCount > 0 ? ((cnt / totalCount) * 100).toFixed(1) : '0.0';
                return `
                        <tr>
                            <td><strong>${lbl}</strong></td>
                            <td style="text-align: right; font-weight: 600;">${cnt}</td>
                            <td style="text-align: right;">
                                <span>${pct}%</span>
                                <div class="table-progress-bar">
                                    <div class="table-progress-fill" style="width: ${pct}%;"></div>
                                </div>
                            </td>
                        </tr>
                    `;
            }).join('')}
            </tbody>
        `;
            tableWrap.appendChild(table);
            return tableWrap;
        }

        // Helper function to build card header with Table toggle
        function buildCardHeader(q, badgeText, labels, dataValues, totalCount, chartCard, canvasContainer, tableContainer) {
            const headerBlock = document.createElement('div');
            headerBlock.className = 'chart-header-block';

            const topRow = document.createElement('div');
            topRow.className = 'card-header-top';

            const title = document.createElement('div');
            title.className = 'chart-title';
            title.textContent = q.question || 'Question';
            topRow.appendChild(title);

            const actionBar = document.createElement('div');
            actionBar.className = 'card-action-bar';

            // Table toggle button
            if (tableContainer) {
                const tableBtn = document.createElement('button');
                tableBtn.className = 'card-action-btn';
                tableBtn.title = 'Toggle Data Table View';
                tableBtn.innerHTML = `<svg width="16" height="16" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>`;
                tableBtn.addEventListener('click', () => {
                    const isTable = tableContainer.style.display !== 'none';
                    if (isTable) {
                        tableContainer.style.display = 'none';
                        canvasContainer.style.display = 'flex';
                        tableBtn.classList.remove('active');
                    } else {
                        tableContainer.style.display = 'block';
                        canvasContainer.style.display = 'none';
                        tableBtn.classList.add('active');
                    }
                });
                actionBar.appendChild(tableBtn);
            }

            topRow.appendChild(actionBar);
            headerBlock.appendChild(topRow);

            const meta = document.createElement('div');
            meta.className = 'chart-meta';
            const totalAns = q.total_answered !== undefined ? q.total_answered : totalCount;
            meta.innerHTML = `
            <span class="chart-badge">👥 Total Responses: <strong>${totalAns}</strong></span>
            <span class="chart-badge">${badgeText}</span>
        `;
            headerBlock.appendChild(meta);

            return headerBlock;
        }

        // Function to render charts based on groups
        function renderDashboard(data) {
            if (typeof Chart === 'undefined') {
                setTimeout(() => renderDashboard(data), 100);
                return;
            }
            applyChartDefaults();
            chartsWrapper.innerHTML = '';

            // Update Title
            const currentForm = data.forms ? data.forms.find(f => f.id == data.current_form_id) : null;
            const titleEl = document.getElementById('analytics-current-form-title');
            if (titleEl && currentForm) {
                titleEl.textContent = currentForm.title;
            }

            // Summary Card (Total Responses)
            const scorecardEl = document.getElementById('executive-scorecard');
            const kpiResponses = document.getElementById('kpi-total-responses');

            if (scorecardEl && data.summary) {
                scorecardEl.style.display = data.summary.total_responses > 0 ? 'grid' : 'none';
                if (kpiResponses) kpiResponses.textContent = data.summary.total_responses;
            }

            // Qualitative Comments Section
            const qualCard = document.getElementById('qualitative-feedback-card');
            if (qualCard) qualCard.style.display = 'none'; // We dynamically build them now

            function createQualitativeCard(titleText, subtitleText, feedbackKeys, data, showArchivedBadge = false) {
                const validKeys = (feedbackKeys || []).filter(qTitle => {
                    const feedbackObj = data.qualitative_feedback ? data.qualitative_feedback[qTitle] : null;
                    return feedbackObj && feedbackObj.comments && feedbackObj.comments.length > 0;
                });
                if (validKeys.length === 0) return null;

                const card = document.createElement('div');
                card.className = 'card qualitative-card';
                card.style.marginTop = '32px';

                const headerHtml = `
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 16px;">
                <div>
                  <h3 style="margin: 0; font-size: 18px; color: var(--text-main);">💬 ${titleText}</h3>
                  <p style="margin: 4px 0 0 0; font-size: 13px; color: var(--text-secondary);">${subtitleText}</p>
                </div>
              </div>
              <div class="qualitative-comments-container"></div>
            `;
                card.innerHTML = headerHtml;

                const qualContainer = card.querySelector('.qualitative-comments-container');
                qualContainer.innerHTML = validKeys.map((qTitle, index) => {
                    const feedbackObj = data.qualitative_feedback[qTitle];
                    const comments = feedbackObj.comments || [];
                    const archivedBadge = showArchivedBadge ? '<span class="chart-badge" style="background:#f1f5f9; color:#64748b; border: 1px solid #cbd5e1;">Archived</span>' : '';

                    return `
                    <div class="comment-question-block accordion-block" data-qtitle="${qTitle.toLowerCase()}">
                        <button class="comment-q-title accordion-btn ${index === 0 ? 'active' : ''}" onclick="this.classList.toggle('active'); const feed = this.nextElementSibling; feed.style.display = feed.style.display === 'block' ? 'none' : 'block';">
                            <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"></path></svg>
                            <span style="text-align: left; flex: 1;">${qTitle}</span>
                            ${archivedBadge}
                            <span class="chart-badge">${comments.length} comments</span>
                            <span class="accordion-icon" style="margin-left: 8px;">▼</span>
                        </button>
                        <div class="comments-feed accordion-content" style="display: ${index === 0 ? 'block' : 'none'}; padding-top: 10px;">
                            <ul style="list-style: none; padding: 0; margin: 0;">
                            ${comments.map(c => `
                                <li class="comment-list-item" style="border-bottom: 1px solid var(--border-color); padding: 12px 8px; display: flex; flex-direction: column; gap: 4px;">
                                    <div class="comment-text" style="color: var(--text-main); font-size: 14px;">${c.text}</div>
                                    <div class="comment-meta" style="display: flex; gap: 12px; font-size: 12px; color: var(--text-secondary);">
                                        <span>${c.respondent ? 'ID: ' + c.respondent : 'Verified'}</span>
                                        <span>${c.date ? new Date(c.date).toLocaleDateString() : ''}</span>
                                    </div>
                                </li>
                            `).join('')}
                            </ul>
                        </div>
                    </div>
                `;
                }).join('');

                return card;
            }

            if (data.summary.total_responses === 0) {
                chartsWrapper.innerHTML = '<div class="card"><p class="no-data" style="margin: 40px 0;">No responses have been collected for this form yet.</p></div>';
                return;
            }

            const globalCard = document.createElement('div');
            globalCard.className = 'card analytics-group';
            globalCard.style.borderTop = 'none';
            globalCard.style.padding = '0';
            globalCard.style.boxShadow = 'none';
            globalCard.style.backgroundColor = 'transparent';

            const globalGrid = document.createElement('div');
            globalGrid.className = 'charts-grid';
            globalCard.appendChild(globalGrid);

            // ── Chart Creators for Single Choice Questions ────────────────────
            function createSlicePercentagePlugin(labels) {
                return {
                    id: 'slicePercentage',
                    afterDatasetsDraw: (chart) => {
                        if (chart.config.type !== 'pie' && chart.config.type !== 'doughnut') return;
                        if (!labels || labels.length > 5) return;

                        const ctx = chart.ctx;
                        ctx.save();
                        ctx.font = '700 12.5px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        const activeElements = (typeof chart.getActiveElements === 'function')
                            ? chart.getActiveElements()
                            : (chart.tooltip?._active || []);
                        const hoveredIndices = new Set(activeElements.map(el => el.index));

                        const ds = chart.data.datasets[0];
                        if (!ds || !ds.data) {
                            ctx.restore();
                            return;
                        }

                        const meta = chart.getDatasetMeta(0);
                        if (!meta || !meta.data) {
                            ctx.restore();
                            return;
                        }

                        const sum = ds.data.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
                        if (sum === 0) {
                            ctx.restore();
                            return;
                        }

                        meta.data.forEach((element, index) => {
                            if (hoveredIndices.has(index)) return;

                            const val = ds.data[index] || 0;
                            const pct = (val / sum) * 100;
                            // Only draw if pct >= 3.5% so text doesn't overflow very tiny slivers
                            if (pct >= 3.5) {
                                const pctString = `${pct.toFixed(pct % 1 === 0 ? 0 : 1)}%`;
                                const pos = (typeof element.tooltipPosition === 'function') ? element.tooltipPosition() : null;
                                if (pos && typeof pos.x === 'number' && typeof pos.y === 'number') {
                                    // Determine text color based on slice background brightness (no white outline or background)
                                    const sliceBg = Array.isArray(ds.backgroundColor) ? ds.backgroundColor[index] : ds.backgroundColor;
                                    let textColor = '#1e293b';
                                    if (sliceBg && typeof sliceBg === 'string' && sliceBg.startsWith('#') && sliceBg.length === 7) {
                                        const r = parseInt(sliceBg.substring(1, 3), 16);
                                        const g = parseInt(sliceBg.substring(3, 5), 16);
                                        const b = parseInt(sliceBg.substring(5, 7), 16);
                                        const lum = (0.299 * r + 0.587 * g + 0.114 * b);
                                        textColor = lum > 165 ? '#1e293b' : '#ffffff';
                                    }
                                    ctx.fillStyle = textColor;
                                    ctx.fillText(pctString, pos.x, pos.y);
                                }
                            }
                        });
                        ctx.restore();
                    }
                };
            }

            function createDonutChart(canvas, q, labels, dataValues, totalSum) {
                const colors = generateColorsForLabels(labels);
                const plugins = [];

                plugins.push({
                    id: 'donutCenterKPI',
                    beforeDraw: (chart) => {
                        if (chart.config.type !== 'doughnut') return;
                        const { ctx, chartArea } = chart;
                        if (!chartArea) return;
                        const centerX = (chartArea.left + chartArea.right) / 2;
                        const centerY = (chartArea.top + chartArea.bottom) / 2;
                        ctx.save();
                        ctx.textAlign = 'center';
                        ctx.textBaseline = 'middle';

                        ctx.font = '700 24px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                        ctx.fillStyle = '#0f172a';
                        ctx.fillText(totalSum, centerX, centerY - 9);

                        ctx.font = '600 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                        ctx.fillStyle = '#64748b';
                        ctx.fillText('RESPONSES', centerX, centerY + 13);
                        ctx.restore();
                    }
                });

                // Display percentage directly on slices if <= 5 options
                if (labels.length <= 5) {
                    plugins.push(createSlicePercentagePlugin(labels));
                }

                return new Chart(canvas, {
                    type: 'doughnut',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Responses',
                            data: dataValues,
                            backgroundColor: colors.backgroundColors,
                            borderColor: '#ffffff',
                            borderWidth: 2,
                            hoverOffset: 6
                        }]
                    },
                    plugins: plugins,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        cutout: '66%',
                        layout: { padding: 10 },
                        plugins: {
                            legend: {
                                display: true,
                                position: window.innerWidth < 768 ? 'bottom' : 'right',
                                labels: {
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    boxWidth: 8,
                                    boxHeight: 8,
                                    padding: labels.length > 10 ? 8 : 10,
                                    font: { size: labels.length > 12 ? 10.5 : (labels.length > 8 ? 11.5 : 12) },
                                    generateLabels: function (chart) {
                                        const chartData = chart.data;
                                        if (chartData.labels.length && chartData.datasets.length) {
                                            const ds = chartData.datasets[0];
                                            const sum = ds.data.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
                                            return chartData.labels.map((label, i) => {
                                                const val = ds.data[i] || 0;
                                                const pct = sum > 0 ? ((val / sum) * 100).toFixed(1) : '0.0';
                                                return {
                                                    text: `${label} (${pct}%)`,
                                                    fillStyle: ds.backgroundColor[i],
                                                    strokeStyle: Array.isArray(ds.borderColor) ? ds.borderColor[i] : (ds.borderColor || '#ffffff'),
                                                    lineWidth: 1,
                                                    hidden: isNaN(ds.data[i]) || (chart.getDatasetMeta(0).data[i] && chart.getDatasetMeta(0).data[i].hidden),
                                                    index: i
                                                };
                                            });
                                        }
                                        return [];
                                    }
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                padding: 14,
                                cornerRadius: 8,
                                titleFont: { size: 14, weight: 'bold' },
                                bodyFont: { size: 13 },
                                callbacks: {
                                    title: (items) => items[0].label || '',
                                    label: (context) => {
                                        const val = context.raw !== undefined ? context.raw : context.parsed;
                                        const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : '0.0';
                                        return [
                                            `  Responses: ${val}`,
                                            `  Percentage: ${pct}%`
                                        ];
                                    },
                                    footer: () => `Total Answers: ${totalSum}`
                                }
                            }
                        }
                    }
                });
            }

            function createSingleHorizontalBar(canvas, q, labels, dataValues, totalSum) {
                // Sort descending by response count
                const sorted = labels.map((lbl, i) => ({ label: lbl, value: dataValues[i] }))
                    .sort((a, b) => b.value - a.value);
                const sortedLabels = sorted.map(s => s.label);
                const sortedValues = sorted.map(s => s.value);
                const sortedColors = generateColorsForLabels(sortedLabels);

                // Auto-detect best orientation: <= 5 options with reasonably short labels look great vertically;
                // more than 5 options or long labels use horizontal bar so text is never truncated.
                const isVertical = sortedLabels.length <= 5 && Math.max(...sortedLabels.map(l => String(l).length)) <= 15;

                return new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: sortedLabels,
                        datasets: [{
                            label: 'Responses',
                            data: sortedValues,
                            backgroundColor: sortedColors.backgroundColors,
                            borderColor: sortedColors.borderColors,
                            borderWidth: 1,
                            borderRadius: isVertical ? { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 } : 6,
                            barPercentage: isVertical ? 0.52 : 0.65,
                            maxBarThickness: isVertical ? 56 : 42
                        }]
                    },
                    options: {
                        indexAxis: isVertical ? 'x' : 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: isVertical ? { top: 12, bottom: 6, left: 8, right: 8 } : { right: 16 } },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                padding: 14,
                                cornerRadius: 8,
                                titleFont: { size: 14, weight: 'bold' },
                                bodyFont: { size: 13 },
                                callbacks: {
                                    title: (items) => items[0].label || '',
                                    label: (context) => {
                                        const val = context.raw || 0;
                                        const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : '0.0';
                                        return [
                                            `  Responses: ${val}`,
                                            `  Percentage: ${pct}%`
                                        ];
                                    },
                                    footer: () => `Total Responses: ${totalSum}`
                                }
                            }
                        },
                        scales: isVertical ? {
                            x: {
                                grid: { display: false },
                                border: { display: false },
                                ticks: {
                                    font: { size: 12.5, weight: '500' },
                                    color: '#334155'
                                }
                            },
                            y: {
                                beginAtZero: true,
                                ticks: {
                                    precision: 0,
                                    maxTicksLimit: 6,
                                    stepSize: Math.max(1, Math.ceil(Math.max(...sortedValues, 1) / 5))
                                },
                                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                                border: { display: false }
                            }
                        } : {
                            x: {
                                beginAtZero: true,
                                ticks: {
                                    precision: 0,
                                    maxTicksLimit: 6,
                                    stepSize: Math.max(1, Math.ceil(Math.max(...sortedValues, 1) / 5))
                                },
                                grid: { color: 'rgba(0, 0, 0, 0.04)' },
                                border: { display: false }
                            },
                            y: {
                                grid: { display: false },
                                border: { display: false },
                                ticks: {
                                    font: { size: 12.5, weight: '500' },
                                    color: '#334155'
                                }
                            }
                        }
                    }
                });
            }

            function createPieChart(canvas, q, labels, dataValues, totalSum) {
                const colors = generateColorsForLabels(labels);
                const plugins = [];
                if (labels.length <= 5) {
                    plugins.push(createSlicePercentagePlugin(labels));
                }

                return new Chart(canvas, {
                    type: 'pie',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: 'Responses',
                            data: dataValues,
                            backgroundColor: colors.backgroundColors,
                            borderColor: '#ffffff',
                            borderWidth: 2,
                            hoverOffset: 8
                        }]
                    },
                    plugins: plugins,
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: 10 },
                        plugins: {
                            legend: {
                                display: true,
                                position: window.innerWidth < 768 ? 'bottom' : 'right',
                                labels: {
                                    usePointStyle: true,
                                    pointStyle: 'circle',
                                    boxWidth: 8,
                                    boxHeight: 8,
                                    padding: labels.length > 10 ? 8 : 10,
                                    font: { size: labels.length > 12 ? 10.5 : (labels.length > 8 ? 11.5 : 12) },
                                    generateLabels: function (chart) {
                                        const chartData = chart.data;
                                        if (chartData.labels.length && chartData.datasets.length) {
                                            const ds = chartData.datasets[0];
                                            const sum = ds.data.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
                                            return chartData.labels.map((label, i) => {
                                                const val = ds.data[i] || 0;
                                                const pct = sum > 0 ? ((val / sum) * 100).toFixed(1) : '0.0';
                                                return {
                                                    text: `${label} (${pct}%)`,
                                                    fillStyle: ds.backgroundColor[i],
                                                    strokeStyle: Array.isArray(ds.borderColor) ? ds.borderColor[i] : (ds.borderColor || '#ffffff'),
                                                    lineWidth: 1,
                                                    hidden: isNaN(ds.data[i]) || (chart.getDatasetMeta(0).data[i] && chart.getDatasetMeta(0).data[i].hidden),
                                                    index: i
                                                };
                                            });
                                        }
                                        return [];
                                    }
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                padding: 14,
                                cornerRadius: 8,
                                titleFont: { size: 14, weight: 'bold' },
                                bodyFont: { size: 13 },
                                callbacks: {
                                    title: (items) => items[0].label || '',
                                    label: (context) => {
                                        const val = context.raw !== undefined ? context.raw : context.parsed;
                                        const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : '0.0';
                                        return [
                                            `  Responses: ${val}`,
                                            `  Percentage: ${pct}%`
                                        ];
                                    },
                                    footer: () => `Total Answers: ${totalSum}`
                                }
                            }
                        }
                    }
                });
            }

            // ── 1. Single-Choice Modern Interactive Renderer ─────────────────
            function renderSingleChoicePieChart(q, qIndex, targetGrid, animDelay) {
                const labels = Object.keys(q.tallies || {});
                const dataValues = Object.values(q.tallies || {});
                const totalSum = dataValues.reduce((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0);
                const totalAns = q.total_answered !== undefined ? q.total_answered : totalSum;

                if (labels.length === 0 || totalSum === 0 || totalAns === 0) {
                    return;
                }

                const chartCard = document.createElement('div');
                chartCard.className = 'chart-card';
                chartCard.dataset.qid = q.id;
                q._domCard = chartCard;
                chartCard.style.animationDelay = `${animDelay}s`;

                // Calculate dynamic container height based on option density and screen size
                let containerHeight = 340;
                if (labels.length > 10) {
                    containerHeight = 480;
                } else if (labels.length > 5) {
                    containerHeight = 400;
                }
                if (window.innerWidth < 768) {
                    containerHeight = Math.max(containerHeight, 380);
                }

                const canvasContainer = document.createElement('div');
                canvasContainer.className = 'chart-container';
                canvasContainer.style.height = containerHeight + 'px';

                const canvas = document.createElement('canvas');
                canvasContainer.appendChild(canvas);

                // Create accessible data table
                const tableContainer = createDataTable(labels, dataValues, totalSum, containerHeight);

                // Header Block with Multi-View Switcher
                const headerBlock = document.createElement('div');
                headerBlock.className = 'chart-header-block';

                const topRow = document.createElement('div');
                topRow.className = 'card-header-top';

                const title = document.createElement('div');
                title.className = 'chart-title';
                title.textContent = q.question || 'Question';
                topRow.appendChild(title);

                const actionBar = document.createElement('div');
                actionBar.className = 'card-action-bar';
                topRow.appendChild(actionBar);
                headerBlock.appendChild(topRow);

                const meta = document.createElement('div');
                meta.className = 'chart-meta';
                headerBlock.appendChild(meta);

                chartCard.appendChild(headerBlock);
                chartCard.appendChild(canvasContainer);
                chartCard.appendChild(tableContainer);
                targetGrid.appendChild(chartCard);

                // Smart default: If > 5 options or long labels, default to Bar;
                // Otherwise, randomize with ratio Pie:Donut = 35:65 (65% Donut, 35% Pie)
                const hasLongLabels = Math.max(...labels.map(l => String(l).length)) > 14;
                const circularDefault = Math.random() < 0.65 ? 'donut' : 'pie';
                const initialView = (labels.length > 5 || hasLongLabels) ? 'bar' : circularDefault;
                let currentChart = null;

                function updateMetaBadge(badgeText) {
                    meta.innerHTML = `
                        <span class="chart-badge">👥 Total Responses: <strong>${totalAns}</strong></span>
                        <span class="chart-badge">${badgeText}</span>
                    `;
                }

                function setView(viewType) {
                    if (viewType !== 'table') {
                        q._currentChartType = viewType;
                    }

                    actionBar.querySelectorAll('.card-action-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.view === viewType);
                    });

                    if (viewType === 'table') {
                        canvasContainer.style.display = 'none';
                        tableContainer.style.display = 'block';
                        updateMetaBadge('📋 Data Table');
                        return;
                    }

                    tableContainer.style.display = 'none';
                    canvasContainer.style.display = 'flex';

                    if (currentChart) {
                        currentChart.destroy();
                        currentChart = null;
                    }

                    if (viewType === 'donut') {
                        updateMetaBadge('🍩 Donut Distribution');
                        currentChart = createDonutChart(canvas, q, labels, dataValues, totalSum);
                    } else if (viewType === 'bar') {
                        const isVertical = labels.length <= 5 && Math.max(...labels.map(l => String(l).length)) <= 15;
                        updateMetaBadge(isVertical ? '📊 Vertical Bar Breakdown' : '📊 Horizontal Breakdown');
                        currentChart = createSingleHorizontalBar(canvas, q, labels, dataValues, totalSum);
                    } else if (viewType === 'pie') {
                        updateMetaBadge('🥧 Pie Distribution');
                        currentChart = createPieChart(canvas, q, labels, dataValues, totalSum);
                    }

                    canvas.style.cursor = 'pointer';
                    canvas.title = "Click to enlarge";
                    canvas.onclick = () => {
                        if (window.openChartModal && currentChart) {
                            window.openChartModal(currentChart, q.question || 'Chart');
                        }
                    };
                }

                const views = [
                    { id: 'donut', icon: '🍩', label: 'Donut' },
                    { id: 'bar', icon: '📊', label: 'Bar' },
                    { id: 'pie', icon: '🥧', label: 'Pie' },
                    { id: 'table', icon: '📋', label: 'Table' }
                ];

                views.forEach(v => {
                    const btn = document.createElement('button');
                    btn.className = 'card-action-btn' + (v.id === initialView ? ' active' : '');
                    btn.dataset.view = v.id;
                    btn.title = `Switch to ${v.label} View`;
                    btn.innerHTML = `<span>${v.icon}</span><span>${v.label}</span>`;
                    btn.addEventListener('click', () => setView(v.id));
                    actionBar.appendChild(btn);
                });

                setView(initialView);
            }

            // ── 2. Multiple-Choice (Checkboxes) Ranked Bar Renderer ──────────
            function renderMultipleChoiceBarChart(q, qIndex, targetGrid, animDelay) {
                const labels = Object.keys(q.tallies || {});
                const dataValues = Object.values(q.tallies || {});
                const totalSum = dataValues.reduce((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0);
                const totalAnswered = q.total_answered !== undefined ? q.total_answered : totalSum;

                if (labels.length === 0 || totalAnswered === 0 || totalSum === 0) {
                    return;
                }

                // Sort descending by vote count
                const sorted = labels.map((l, i) => ({ label: l, value: dataValues[i] }))
                    .sort((a, b) => b.value - a.value);
                const sortedLabels = sorted.map(s => s.label);
                const sortedValues = sorted.map(s => s.value);

                const chartCard = document.createElement('div');
                chartCard.className = 'chart-card';
                chartCard.dataset.qid = q.id;
                q._domCard = chartCard;
                chartCard.style.animationDelay = `${animDelay}s`;

                let containerHeight = Math.max(340, sortedLabels.length * 38 + 60);
                if (sortedLabels.length > 5) {
                    chartCard.style.gridColumn = '1 / -1';
                }

                const canvasContainer = document.createElement('div');
                canvasContainer.className = 'chart-container';
                canvasContainer.style.height = containerHeight + 'px';

                const canvas = document.createElement('canvas');
                canvasContainer.appendChild(canvas);

                const tableContainer = createDataTable(sortedLabels, sortedValues, totalAnswered, containerHeight);

                const headerBlock = document.createElement('div');
                headerBlock.className = 'chart-header-block';

                const topRow = document.createElement('div');
                topRow.className = 'card-header-top';

                const title = document.createElement('div');
                title.className = 'chart-title';
                title.textContent = q.question || 'Question';
                topRow.appendChild(title);

                const actionBar = document.createElement('div');
                actionBar.className = 'card-action-bar';
                topRow.appendChild(actionBar);
                headerBlock.appendChild(topRow);

                const meta = document.createElement('div');
                meta.className = 'chart-meta';
                headerBlock.appendChild(meta);

                chartCard.appendChild(headerBlock);
                chartCard.appendChild(canvasContainer);
                chartCard.appendChild(tableContainer);
                targetGrid.appendChild(chartCard);

                let currentChart = null;

                function updateMeta(badgeText) {
                    meta.innerHTML = `
                        <span class="chart-badge">👥 Total Respondents: <strong>${totalAnswered}</strong></span>
                        <span class="chart-badge">${badgeText}</span>
                    `;
                }

                function setView(viewType) {
                    if (viewType !== 'table') {
                        q._currentChartType = 'bar';
                    }

                    actionBar.querySelectorAll('.card-action-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.view === viewType);
                    });

                    if (viewType === 'table') {
                        canvasContainer.style.display = 'none';
                        tableContainer.style.display = 'block';
                        updateMeta('📋 Data Table');
                        return;
                    }

                    tableContainer.style.display = 'none';
                    canvasContainer.style.display = 'flex';

                    const isVertical = sortedLabels.length <= 5 && Math.max(...sortedLabels.map(l => String(l).length)) <= 15;
                    updateMeta(isVertical ? '📊 Ranked Frequency (Vertical)' : '📊 Ranked Frequency (% of Respondents)');

                    if (currentChart) {
                        currentChart.destroy();
                        currentChart = null;
                    }

                    const colors = generateColorsForLabels(sortedLabels);
                    currentChart = new Chart(canvas, {
                        type: 'bar',
                        data: {
                            labels: sortedLabels,
                            datasets: [{
                                label: 'Respondents',
                                data: sortedValues,
                                backgroundColor: colors.backgroundColors,
                                borderColor: colors.borderColors,
                                borderWidth: 1,
                                borderRadius: isVertical ? { topLeft: 6, topRight: 6, bottomLeft: 0, bottomRight: 0 } : 6,
                                barPercentage: isVertical ? 0.52 : 0.65,
                                maxBarThickness: isVertical ? 56 : 42
                            }]
                        },
                        options: {
                            indexAxis: isVertical ? 'x' : 'y',
                            responsive: true,
                            maintainAspectRatio: false,
                            layout: { padding: isVertical ? { top: 12, bottom: 6, left: 8, right: 8 } : { right: 16 } },
                            plugins: {
                                legend: { display: false },
                                tooltip: {
                                    backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                    padding: 14,
                                    cornerRadius: 8,
                                    titleFont: { size: 14, weight: 'bold' },
                                    bodyFont: { size: 13 },
                                    callbacks: {
                                        title: (items) => items[0].label || '',
                                        label: (context) => {
                                            const val = context.raw || 0;
                                            const pct = totalAnswered > 0 ? ((val / totalAnswered) * 100).toFixed(1) : '0.0';
                                            return [
                                                `  Selected by: ${val} respondents`,
                                                `  Percentage: ${pct}% of respondents`
                                            ];
                                        },
                                        footer: () => `Total Question Respondents: ${totalAnswered}`
                                    }
                                }
                            },
                            scales: isVertical ? {
                                x: {
                                    grid: { display: false },
                                    border: { display: false },
                                    ticks: { font: { size: 12.5, weight: '500' }, color: '#334155' }
                                },
                                y: {
                                    beginAtZero: true,
                                    ticks: {
                                        precision: 0,
                                        maxTicksLimit: 6,
                                        stepSize: Math.max(1, Math.ceil(Math.max(...sortedValues, 1) / 5))
                                    },
                                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                                    border: { display: false }
                                }
                            } : {
                                x: {
                                    beginAtZero: true,
                                    ticks: {
                                        precision: 0,
                                        maxTicksLimit: 6,
                                        stepSize: Math.max(1, Math.ceil(Math.max(...sortedValues, 1) / 5))
                                    },
                                    grid: { color: 'rgba(0, 0, 0, 0.04)' },
                                    border: { display: false }
                                },
                                y: {
                                    grid: { display: false },
                                    border: { display: false },
                                    ticks: { font: { size: 13, weight: '500' }, color: '#334155' }
                                }
                            }
                        }
                    });

                    canvas.style.cursor = 'pointer';
                    canvas.title = "Click to enlarge";
                    canvas.onclick = () => {
                        if (window.openChartModal && currentChart) {
                            window.openChartModal(currentChart, q.question || 'Ranked Frequency');
                        }
                    };
                }

                const views = [
                    { id: 'bar', icon: '📊', label: 'Ranked Bars' },
                    { id: 'table', icon: '📋', label: 'Table' }
                ];

                views.forEach(v => {
                    const btn = document.createElement('button');
                    btn.className = 'card-action-btn' + (v.id === 'bar' ? ' active' : '');
                    btn.dataset.view = v.id;
                    btn.title = `Switch to ${v.label} View`;
                    btn.innerHTML = `<span>${v.icon}</span><span>${v.label}</span>`;
                    btn.addEventListener('click', () => setView(v.id));
                    actionBar.appendChild(btn);
                });

                setView('bar');
            }

            // ── Helpers for Group Matrix (Linear Scale / Rating Scale) ─────────
            function categorizeLikertOptions(allOptions) {
                const scored = allOptions.map(opt => {
                    let text = String(opt).toLowerCase().trim();
                    const clean = text.replace(/^\d+[\s\-\.\)]+/, '').replace(/\((.*?)\)/, '$1').trim();
                    let score = 3;

                    if (['excellent', 'strongly agree', 'highly effective', 'always available', 'frequently', 'very affordable', 'very secure'].some(k => clean.includes(k))) {
                        score = 5;
                    } else if (['very good', 'often', 'very satisfied'].some(k => clean.includes(k))) {
                        score = 4.5;
                    } else if (['good', 'agree', 'effective', 'satisfied', 'affordable', 'secure', 'yes'].some(k => clean.includes(k))) {
                        score = 4;
                    } else if (['average', 'neutral', 'satisfactory', 'sometimes', 'moderately', 'not sure'].some(k => clean.includes(k))) {
                        score = 3;
                    } else if (['below average', 'disagree', 'dissatisfied', 'rarely', 'somewhat dissatisfied', 'expensive'].some(k => clean.includes(k))) {
                        score = 2;
                    } else if (['poor', 'strongly disagree', 'very poor', 'never', 'ineffective', 'very dissatisfied', 'not available', 'no'].some(k => clean.includes(k))) {
                        score = 1;
                    } else {
                        const m = text.match(/^(\d+)/);
                        if (m) score = parseFloat(m[1]);
                    }
                    return { option: opt, score: score, clean: clean };
                });

                const uniqueScores = new Set(scored.map(s => s.score));
                const hasLikertPolarity = uniqueScores.size >= 2 && scored.some(s => s.score < 2.9) && scored.some(s => s.score > 3.1);

                // Sort ascending from lowest negative to highest positive
                scored.sort((a, b) => a.score - b.score);

                const negOptions = scored.filter(s => s.score < 2.9);
                const neuOptions = scored.filter(s => s.score >= 2.9 && s.score <= 3.1);
                const posOptions = scored.filter(s => s.score > 3.1);

                return { scored, hasLikertPolarity, negOptions, neuOptions, posOptions };
            }

            function createGroupMatrixTable(group, questionsToRender, allOptions) {
                const tableWrap = document.createElement('div');
                tableWrap.className = 'chart-data-table-container';
                tableWrap.style.display = 'none';

                const table = document.createElement('table');
                table.className = 'chart-data-table';
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th style="min-width: 240px;">Question Statement</th>
                            ${allOptions.map(opt => `<th style="text-align: right; min-width: 90px;">${opt}</th>`).join('')}
                            <th style="text-align: right; min-width: 110px;">Weighted Avg</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${questionsToRender.map(q => {
                            const total = q.total_answered || 1;
                            const scoreText = q.weighted_score ? `${parseFloat(q.weighted_score).toFixed(2)} / 5.0` : 'N/A';
                            return `
                                <tr>
                                    <td><strong>${q.question}</strong></td>
                                    ${allOptions.map(opt => {
                                        const cnt = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                                        const pct = ((cnt / total) * 100).toFixed(1);
                                        return `<td style="text-align: right;">${cnt} <span style="font-size: 11px; color: var(--text-secondary);">(${pct}%)</span></td>`;
                                    }).join('')}
                                    <td style="text-align: right; font-weight: 700; color: var(--primary-color);">${scoreText}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                `;
                tableWrap.appendChild(table);
                return tableWrap;
            }

            function createDivergingLikertChart(canvas, group, questionsToRender, allOptions, likertInfo) {
                const questionLabels = questionsToRender.map(q => {
                    return q.question.length > 70 ? q.question.substring(0, 68) + '...' : q.question;
                });

                const { negOptions, neuOptions, posOptions } = likertInfo;
                const datasets = [];

                // 1. Moderate Negative (closer to center 0) then Extreme Negative (farther left)
                // In Chart.js horizontal stack:
                // If neutral exists, neutral left stacks from 0 to -neu/2.
                if (neuOptions.length > 0) {
                    const neuOpt = neuOptions[0].option;
                    const neuColor = getSemanticColor(neuOpt) || { bg: '#fde047', border: '#ca8a04' };
                    datasets.push({
                        label: neuOpt,
                        _originalOption: neuOpt,
                        data: questionsToRender.map(q => {
                            const cnt = (q.tallies && q.tallies[neuOpt]) ? q.tallies[neuOpt] : 0;
                            const total = q.total_answered || 1;
                            return -parseFloat(((cnt / total) * 50).toFixed(2)); // 50% on negative side
                        }),
                        backgroundColor: neuColor.bg,
                        borderColor: neuColor.border,
                        borderWidth: 1,
                        barPercentage: 0.65
                    });
                }

                // Reverse negOptions so moderate negative is first (adjacent to neutral) and extreme negative is last (outermost left)
                const negReversed = [...negOptions].reverse();
                negReversed.forEach(item => {
                    const opt = item.option;
                    const color = getSemanticColor(opt) || { bg: '#fdba74', border: '#ea580c' };
                    datasets.push({
                        label: opt,
                        _originalOption: opt,
                        data: questionsToRender.map(q => {
                            const cnt = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                            const total = q.total_answered || 1;
                            return -parseFloat(((cnt / total) * 100).toFixed(2));
                        }),
                        backgroundColor: color.bg,
                        borderColor: color.border,
                        borderWidth: 1,
                        barPercentage: 0.65
                    });
                });

                // 2. Positive side: Neutral right (from 0 to +neu/2), then moderate positive, then extreme positive
                if (neuOptions.length > 0) {
                    const neuOpt = neuOptions[0].option;
                    const neuColor = getSemanticColor(neuOpt) || { bg: '#fde047', border: '#ca8a04' };
                    datasets.push({
                        label: neuOpt + '_hidden',
                        _originalOption: neuOpt,
                        data: questionsToRender.map(q => {
                            const cnt = (q.tallies && q.tallies[neuOpt]) ? q.tallies[neuOpt] : 0;
                            const total = q.total_answered || 1;
                            return parseFloat(((cnt / total) * 50).toFixed(2)); // 50% on positive side
                        }),
                        backgroundColor: neuColor.bg,
                        borderColor: neuColor.border,
                        borderWidth: 1,
                        barPercentage: 0.65
                    });
                }

                posOptions.forEach(item => {
                    const opt = item.option;
                    const color = getSemanticColor(opt) || { bg: '#86efac', border: '#16a34a' };
                    datasets.push({
                        label: opt,
                        _originalOption: opt,
                        data: questionsToRender.map(q => {
                            const cnt = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                            const total = q.total_answered || 1;
                            return parseFloat(((cnt / total) * 100).toFixed(2));
                        }),
                        backgroundColor: color.bg,
                        borderColor: color.border,
                        borderWidth: 1,
                        barPercentage: 0.65
                    });
                });

                return new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: questionLabels,
                        datasets: datasets
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: { right: 16 } },
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    usePointStyle: true,
                                    padding: 16,
                                    font: { size: 12.5, weight: '500' },
                                    filter: (item) => !item.text.includes('_hidden')
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                padding: 14,
                                cornerRadius: 8,
                                titleFont: { size: 14, weight: 'bold' },
                                bodyFont: { size: 13 },
                                callbacks: {
                                    title: (items) => {
                                        if (!items || !items.length) return '';
                                        const qIdx = items[0].dataIndex;
                                        return questionsToRender[qIdx] ? questionsToRender[qIdx].question : items[0].label;
                                    },
                                    label: (context) => {
                                        const qIdx = context.dataIndex;
                                        const q = questionsToRender[qIdx];
                                        const opt = context.dataset._originalOption || context.dataset.label;
                                        const count = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                                        const total = q.total_answered || 1;
                                        const pct = ((count / total) * 100).toFixed(1);
                                        return [
                                            `  Option: ${opt}`,
                                            `  Responses: ${count}`,
                                            `  Percentage: ${pct}% of question responses`
                                        ];
                                    },
                                    footer: (items) => {
                                        if (!items || !items.length) return '';
                                        const qIdx = items[0].dataIndex;
                                        const q = questionsToRender[qIdx];
                                        const score = q && q.weighted_score ? ` | Avg Score: ${parseFloat(q.weighted_score).toFixed(2)} / 5.0` : '';
                                        return q ? `Total Question Respondents: ${q.total_answered}${score}` : '';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                                grid: {
                                    color: (ctx) => (ctx.tick && ctx.tick.value === 0) ? '#0f172a' : 'rgba(0, 0, 0, 0.05)',
                                    lineWidth: (ctx) => (ctx.tick && ctx.tick.value === 0) ? 2 : 1
                                },
                                ticks: {
                                    stepSize: 20,
                                    callback: (val) => Math.abs(val) + '%',
                                    precision: 0
                                }
                            },
                            y: {
                                stacked: true,
                                grid: { display: false },
                                border: { display: false },
                                ticks: {
                                    font: { size: 12.5, weight: '500' },
                                    color: '#334155'
                                }
                            }
                        }
                    }
                });
            }

            function createStacked100Chart(canvas, group, questionsToRender, allOptions) {
                const questionLabels = questionsToRender.map(q => {
                    return q.question.length > 70 ? q.question.substring(0, 68) + '...' : q.question;
                });
                const colors = generateColorsForLabels(allOptions);

                const datasets = allOptions.map((opt, i) => {
                    const dataPoints = questionsToRender.map(q => {
                        const cnt = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                        const total = q.total_answered || 1;
                        return parseFloat(((cnt / total) * 100).toFixed(2));
                    });
                    const sem = getSemanticColor(opt);
                    const bg = sem ? sem.bg : colors.backgroundColors[i % colors.backgroundColors.length];
                    const border = sem ? sem.border : colors.borderColors[i % colors.borderColors.length];
                    return {
                        label: opt,
                        _originalOption: opt,
                        data: dataPoints,
                        backgroundColor: bg,
                        borderColor: border,
                        borderWidth: 1,
                        borderRadius: 3,
                        barPercentage: 0.68
                    };
                });

                return new Chart(canvas, {
                    type: 'bar',
                    data: {
                        labels: questionLabels,
                        datasets: datasets
                    },
                    options: {
                        indexAxis: 'y',
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: { right: 16 } },
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: {
                                    usePointStyle: true,
                                    padding: 16,
                                    font: { size: 12.5, weight: '500' }
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                padding: 14,
                                cornerRadius: 8,
                                titleFont: { size: 14, weight: 'bold' },
                                bodyFont: { size: 13 },
                                callbacks: {
                                    title: (items) => {
                                        if (!items || !items.length) return '';
                                        const qIdx = items[0].dataIndex;
                                        return questionsToRender[qIdx] ? questionsToRender[qIdx].question : items[0].label;
                                    },
                                    label: (context) => {
                                        const qIdx = context.dataIndex;
                                        const q = questionsToRender[qIdx];
                                        const opt = context.dataset._originalOption || context.dataset.label;
                                        const count = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                                        const pct = context.raw || 0;
                                        return [
                                            `  Option: ${opt}`,
                                            `  Responses: ${count}`,
                                            `  Percentage: ${pct}% of question responses`
                                        ];
                                    },
                                    footer: (items) => {
                                        if (!items || !items.length) return '';
                                        const qIdx = items[0].dataIndex;
                                        const q = questionsToRender[qIdx];
                                        return q ? `Total Question Respondents: ${q.total_answered}` : '';
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                stacked: true,
                                min: 0,
                                max: 100,
                                ticks: {
                                    stepSize: 20,
                                    callback: (val) => val + '%',
                                    precision: 0
                                },
                                grid: { color: 'rgba(0, 0, 0, 0.05)' },
                                border: { display: false }
                            },
                            y: {
                                stacked: true,
                                grid: { display: false },
                                border: { display: false },
                                ticks: {
                                    font: { size: 12.5, weight: '500' },
                                    color: '#334155'
                                }
                            }
                        }
                    }
                });
            }

            function createRadarChart(canvas, group, questionsToRender) {
                const shortLabels = questionsToRender.map(q => {
                    return q.question.length > 40 ? q.question.substring(0, 38) + '...' : q.question;
                });
                const scores = questionsToRender.map(q => {
                    return q.weighted_score ? parseFloat(q.weighted_score).toFixed(2) : 0;
                });

                return new Chart(canvas, {
                    type: 'radar',
                    data: {
                        labels: shortLabels,
                        datasets: [{
                            label: 'Average Rating Score (out of 5.0)',
                            data: scores,
                            backgroundColor: 'rgba(26, 115, 232, 0.22)',
                            borderColor: '#1a73e8',
                            borderWidth: 2.5,
                            pointBackgroundColor: '#1a73e8',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointHoverBackgroundColor: '#ffffff',
                            pointHoverBorderColor: '#1a73e8',
                            pointRadius: 4.5,
                            pointHoverRadius: 7
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: {
                            legend: {
                                position: 'top',
                                labels: { font: { size: 13, weight: '600' } }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                padding: 14,
                                cornerRadius: 8,
                                titleFont: { size: 14, weight: 'bold' },
                                bodyFont: { size: 13 },
                                callbacks: {
                                    title: (items) => {
                                        if (!items || !items.length) return '';
                                        const idx = items[0].dataIndex;
                                        return questionsToRender[idx] ? questionsToRender[idx].question : items[0].label;
                                    },
                                    label: (context) => {
                                        const val = context.raw || 0;
                                        const pct = ((val / 5) * 100).toFixed(1);
                                        return [
                                            `  Weighted Score: ${val} / 5.0`,
                                            `  Satisfaction Level: ${pct}%`
                                        ];
                                    }
                                }
                            }
                        },
                        scales: {
                            r: {
                                min: 0,
                                max: 5,
                                ticks: {
                                    stepSize: 1,
                                    backdropColor: 'transparent',
                                    font: { size: 11, weight: '600' }
                                },
                                pointLabels: {
                                    font: { size: 12, weight: '500' },
                                    color: '#334155'
                                },
                                grid: { color: 'rgba(0, 0, 0, 0.08)' },
                                angleLines: { color: 'rgba(0, 0, 0, 0.08)' }
                            }
                        }
                    }
                });
            }

            // ── 3. Grouped Rating Matrix Modern Interactive Renderer ──────────
            function renderGroupedStackedBar(group, questionsToRender, targetGrid, animDelay) {
                const validQuestions = (questionsToRender || []).filter(hasQuestionResponses);
                if (validQuestions.length === 0) return;
                questionsToRender = validQuestions;

                let allOptions = group.options && group.options.length > 0 ? group.options : [];
                if (allOptions.length === 0) {
                    const optSet = new Set();
                    questionsToRender.forEach(q => Object.keys(q.tallies || {}).forEach(k => optSet.add(k)));
                    allOptions = Array.from(optSet);
                }

                const likertInfo = categorizeLikertOptions(allOptions);
                const initialView = Math.random() < 0.5 ? 'stacked' : 'radar';

                const chartCard = document.createElement('div');
                chartCard.className = 'chart-card';
                chartCard.dataset.groupName = group.group_name || '';
                group._domCard = chartCard;
                chartCard.style.gridColumn = '1 / -1';
                chartCard.style.padding = '24px';
                chartCard.style.animationDelay = `${animDelay}s`;

                const chartHeader = document.createElement('div');
                chartHeader.className = 'chart-header-block';

                const topRow = document.createElement('div');
                topRow.className = 'card-header-top';

                const chartTitle = document.createElement('div');
                chartTitle.className = 'chart-title';
                chartTitle.style.fontSize = '18px';
                chartTitle.style.marginBottom = '6px';
                chartTitle.textContent = group.group_name || 'Comparative Group Analysis';
                topRow.appendChild(chartTitle);

                const actionBar = document.createElement('div');
                actionBar.className = 'card-action-bar';
                topRow.appendChild(actionBar);
                chartHeader.appendChild(topRow);

                const chartMeta = document.createElement('div');
                chartMeta.className = 'chart-meta';
                chartHeader.appendChild(chartMeta);
                chartCard.appendChild(chartHeader);

                const defaultCanvasHeight = Math.max(340, questionsToRender.length * 60 + 90);
                const canvasContainer = document.createElement('div');
                canvasContainer.className = 'chart-container';
                canvasContainer.style.height = defaultCanvasHeight + 'px';

                const canvas = document.createElement('canvas');
                canvasContainer.appendChild(canvas);
                chartCard.appendChild(canvasContainer);

                // Table Container
                const tableContainer = createGroupMatrixTable(group, questionsToRender, allOptions);
                chartCard.appendChild(tableContainer);

                targetGrid.appendChild(chartCard);

                let currentChart = null;

                function updateMeta(badgeText) {
                    chartMeta.innerHTML = `
                        <span class="chart-badge">📝 ${questionsToRender.length} Questions</span>
                        <span class="chart-badge">${badgeText}</span>
                    `;
                }

                function setView(viewType) {
                    if (viewType !== 'table') {
                        group._currentChartType = viewType;
                    }

                    actionBar.querySelectorAll('.card-action-btn').forEach(btn => {
                        btn.classList.toggle('active', btn.dataset.view === viewType);
                    });

                    if (viewType === 'table') {
                        canvasContainer.style.display = 'none';
                        tableContainer.style.display = 'block';
                        updateMeta('📋 Rating Matrix Data Table');
                        return;
                    }

                    tableContainer.style.display = 'none';
                    canvasContainer.style.display = 'flex';

                    if (currentChart) {
                        currentChart.destroy();
                        currentChart = null;
                    }

                    if (viewType === 'diverging') {
                        canvasContainer.style.height = defaultCanvasHeight + 'px';
                        updateMeta('⚖️ Diverging Likert Scale');
                        currentChart = createDivergingLikertChart(canvas, group, questionsToRender, allOptions, likertInfo);
                    } else if (viewType === 'stacked') {
                        canvasContainer.style.height = defaultCanvasHeight + 'px';
                        updateMeta('📊 100% Stacked Bar Breakdown');
                        currentChart = createStacked100Chart(canvas, group, questionsToRender, allOptions);
                    } else if (viewType === 'radar') {
                        canvasContainer.style.height = '430px';
                        updateMeta('🕸️ Radar / Spider Strength View');
                        currentChart = createRadarChart(canvas, group, questionsToRender);
                    }

                    canvas.style.cursor = 'pointer';
                    canvas.title = "Click to enlarge";
                    canvas.onclick = () => {
                        if (window.openChartModal && currentChart) {
                            window.openChartModal(currentChart, group.group_name || 'Group Analysis');
                        }
                    };
                }

                const views = [
                    { id: 'stacked', icon: '📊', label: 'Stacked Bar' },
                    { id: 'diverging', icon: '⚖️', label: 'Diverging' },
                    { id: 'radar', icon: '🕸️', label: 'Radar' },
                    { id: 'table', icon: '📋', label: 'Table' }
                ];

                views.forEach(v => {
                    const btn = document.createElement('button');
                    btn.className = 'card-action-btn' + (v.id === initialView ? ' active' : '');
                    btn.dataset.view = v.id;
                    btn.title = `Switch to ${v.label} View`;
                    btn.innerHTML = `<span>${v.icon}</span><span>${v.label}</span>`;
                    btn.addEventListener('click', () => setView(v.id));
                    actionBar.appendChild(btn);
                });

                setView(initialView);
            }

            // ── Form Activity & Timeline Line Chart Renderer (Case B: Submission Spikes) ──
            function createTimelineLineChart(canvas, timelineData, granularity = 'daily', isCumulative = false) {
                const series = granularity === 'monthly' ? (timelineData.monthly || []) : (timelineData.daily || []);
                const labels = series.map(s => s.short_label || s.label);
                const fullLabels = series.map(s => s.label);
                const dataValues = series.map(s => isCumulative ? s.cumulative : s.count);
                const totalCount = timelineData.total_count || 1;

                return new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: [{
                            label: isCumulative ? 'Cumulative Responses' : (granularity === 'monthly' ? 'Monthly Submissions' : 'Daily Submissions'),
                            data: dataValues,
                            borderColor: '#b32b2b',
                            borderWidth: 2.75,
                            fill: false,
                            tension: 0.35,
                            pointBackgroundColor: '#b32b2b',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: labels.length > 30 ? 2.5 : 4.5,
                            pointHoverRadius: 7,
                            pointHoverBackgroundColor: '#991b1b',
                            pointHoverBorderColor: '#ffffff',
                            pointHoverBorderWidth: 2.5
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: { top: 12, right: 16, bottom: 8, left: 8 } },
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        plugins: {
                            legend: { display: false },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                padding: 12,
                                cornerRadius: 8,
                                titleFont: { size: 13, weight: 'bold' },
                                bodyFont: { size: 12.5 },
                                callbacks: {
                                    title: (items) => fullLabels[items[0].dataIndex] || items[0].label,
                                    label: (context) => {
                                        const val = context.raw || 0;
                                        const idx = context.dataIndex;
                                        const item = series[idx] || {};
                                        const pct = item.percentage !== undefined ? item.percentage : ((val / totalCount) * 100).toFixed(1);
                                        const lines = [
                                            `  ${isCumulative ? 'Cumulative Total' : 'Submissions'}: ${val}`,
                                            `  Share of Form: ${pct}%`
                                        ];
                                        if (!isCumulative && item.cumulative !== undefined) {
                                            lines.push(`  Cumulative to Date: ${item.cumulative}`);
                                        }
                                        return lines;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false, drawBorder: false },
                                ticks: {
                                    font: { size: 11 },
                                    color: '#64748b',
                                    maxRotation: labels.length > 12 ? 45 : 0,
                                    autoSkip: true,
                                    maxTicksLimit: 5
                                }
                            },
                            y: {
                                beginAtZero: true,
                                grid: { color: 'rgba(226, 232, 240, 0.7)', drawBorder: false },
                                ticks: {
                                    precision: 0,
                                    font: { size: 11 },
                                    color: '#64748b',
                                    maxTicksLimit: 6,
                                    stepSize: Math.max(1, Math.ceil(Math.max(...dataValues) / 5))
                                }
                            }
                        }
                    }
                });
            }

            function createTimelineDataTable(timelineData, granularity = 'daily') {
                const series = granularity === 'monthly' ? (timelineData.monthly || []) : (timelineData.daily || []);
                const tableWrap = document.createElement('div');
                tableWrap.className = 'chart-data-table-container';
                tableWrap.style.display = 'none';
                tableWrap.style.maxHeight = '330px';
                tableWrap.style.overflowY = 'auto';

                const table = document.createElement('table');
                table.className = 'chart-data-table';
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th style="min-width: 140px; text-align: left;">${granularity === 'monthly' ? 'Month' : 'Date'}</th>
                            <th style="text-align: right; min-width: 110px;">Submissions</th>
                            <th style="text-align: right; min-width: 90px;">% Share</th>
                            <th style="text-align: right; min-width: 110px;">Cumulative</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${series.map(item => `
                            <tr>
                                <td><strong>${item.label}</strong></td>
                                <td style="text-align: right; font-weight: 600; color: #b32b2b;">${item.count}</td>
                                <td style="text-align: right; color: #475569;">${item.percentage}%</td>
                                <td style="text-align: right; font-weight: 600; color: #0284c7;">${item.cumulative}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                `;
                tableWrap.appendChild(table);
                return tableWrap;
            }

            function renderSubmissionTimelineCard(timelineData) {
                if (!timelineData || !timelineData.has_timeline) return null;

                const card = document.createElement('div');
                card.className = 'chart-card timeline-activity-card';
                card.dataset.section = 'timeline';
                timelineData._domCard = card;

                const headerBlock = document.createElement('div');
                headerBlock.className = 'chart-header-block';

                const topRow = document.createElement('div');
                topRow.className = 'chart-header-top-row';

                const title = document.createElement('div');
                title.className = 'chart-title';
                title.innerHTML = `<span>📈</span> Form Activity & Response Velocity`;
                topRow.appendChild(title);

                const actionBar = document.createElement('div');
                actionBar.className = 'card-action-bar';
                topRow.appendChild(actionBar);
                headerBlock.appendChild(topRow);

                const meta = document.createElement('div');
                meta.className = 'chart-meta';
                headerBlock.appendChild(meta);

                card.appendChild(headerBlock);

                const canvasContainer = document.createElement('div');
                canvasContainer.className = 'chart-container';
                canvasContainer.style.height = '330px';

                const canvas = document.createElement('canvas');
                canvasContainer.appendChild(canvas);
                card.appendChild(canvasContainer);

                let currentGranularity = timelineData.daily.length > 40 ? 'monthly' : 'daily';
                let isCumulative = false;
                let isTableView = false;
                let currentChart = null;
                let tableContainer = null;

                function updateMetaBadge() {
                    const peakText = currentGranularity === 'monthly' ? timelineData.peak_month : timelineData.peak_day;
                    meta.innerHTML = `
                        <span class="chart-badge">👥 Total: <strong>${timelineData.total_count}</strong> Responses</span>
                        ${peakText ? `<span class="chart-badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">⚡ Peak: <strong>${peakText}</strong></span>` : ''}
                        ${timelineData.start_date ? `<span class="chart-badge" style="background: #f1f5f9; color: #475569;">📅 ${timelineData.start_date} – ${timelineData.end_date}</span>` : ''}
                        <span class="chart-badge" style="background: #eff6ff; color: #1e40af;">${isCumulative ? '📈 Cumulative Growth Curve' : (currentGranularity === 'monthly' ? '🗓️ Monthly Spikes' : '📅 Daily Spikes')}</span>
                    `;
                }

                function renderView() {
                    timelineData._currentGranularity = currentGranularity;
                    timelineData._isCumulative = isCumulative;
                    timelineData._isTableView = isTableView;

                    if (tableContainer) {
                        card.removeChild(tableContainer);
                        tableContainer = null;
                    }

                    if (isTableView) {
                        canvasContainer.style.display = 'none';
                        tableContainer = createTimelineDataTable(timelineData, currentGranularity);
                        tableContainer.style.display = 'block';
                        card.appendChild(tableContainer);
                    } else {
                        canvasContainer.style.display = 'flex';
                        if (currentChart) {
                            currentChart.destroy();
                            currentChart = null;
                        }
                        currentChart = createTimelineLineChart(canvas, timelineData, currentGranularity, isCumulative);
                        canvas.style.cursor = 'pointer';
                        canvas.title = "Click to enlarge";
                        canvas.onclick = () => {
                            if (window.openChartModal && currentChart) {
                                window.openChartModal(currentChart, 'Form Activity & Response Velocity');
                            }
                        };
                    }

                    updateMetaBadge();
                    updateActionButtons();
                }

                function updateActionButtons() {
                    actionBar.innerHTML = '';

                    // 1. Daily Toggle
                    const dailyBtn = document.createElement('button');
                    dailyBtn.className = 'card-action-btn' + (currentGranularity === 'daily' && !isTableView ? ' active' : '');
                    dailyBtn.title = 'Switch to Daily Activity Spikes';
                    dailyBtn.innerHTML = `<span>📅</span><span>Daily</span>`;
                    dailyBtn.addEventListener('click', () => {
                        isTableView = false;
                        currentGranularity = 'daily';
                        renderView();
                    });
                    actionBar.appendChild(dailyBtn);

                    // 2. Monthly Toggle
                    const monthlyBtn = document.createElement('button');
                    monthlyBtn.className = 'card-action-btn' + (currentGranularity === 'monthly' && !isTableView ? ' active' : '');
                    monthlyBtn.title = 'Switch to Monthly Activity Spikes';
                    monthlyBtn.innerHTML = `<span>🗓️</span><span>Monthly</span>`;
                    monthlyBtn.addEventListener('click', () => {
                        isTableView = false;
                        currentGranularity = 'monthly';
                        renderView();
                    });
                    actionBar.appendChild(monthlyBtn);

                    // 3. Cumulative Growth Curve Toggle
                    const cumBtn = document.createElement('button');
                    cumBtn.className = 'card-action-btn' + (isCumulative && !isTableView ? ' active' : '');
                    cumBtn.title = 'Toggle Cumulative Total Growth Curve';
                    cumBtn.innerHTML = `<span>📈</span><span>Cumulative</span>`;
                    cumBtn.addEventListener('click', () => {
                        isTableView = false;
                        isCumulative = !isCumulative;
                        renderView();
                    });
                    actionBar.appendChild(cumBtn);

                    // 4. Data Table Toggle
                    const tableBtn = document.createElement('button');
                    tableBtn.className = 'card-action-btn' + (isTableView ? ' active' : '');
                    tableBtn.title = 'Toggle Data Table View';
                    tableBtn.innerHTML = `<span>📋</span><span>Table</span>`;
                    tableBtn.addEventListener('click', () => {
                        isTableView = !isTableView;
                        renderView();
                    });
                    actionBar.appendChild(tableBtn);
                }

                renderView();
                return card;
            }

            // ── Year-over-Year (YoY) Performance Trend (Multi-Year NAAC / IQAC Accreditation) ──
            function createYoYLineChart(canvas, yoyData, viewMode = 'overall') {
                const labels = yoyData.overall_series.map(s => s.label);
                const years = yoyData.years;

                let datasets = [];

                if (viewMode === 'overall') {
                    const overallScores = yoyData.overall_series.map(s => s.score_5);
                    datasets = [
                        {
                            label: 'Overall Rating Score (/5.0)',
                            data: overallScores,
                            borderColor: '#b32b2b',
                            backgroundColor: '#b32b2b',
                            borderWidth: 3,
                            fill: false,
                            tension: 0.35,
                            pointBackgroundColor: '#b32b2b',
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2.5,
                            pointRadius: 5.5,
                            pointHoverRadius: 8,
                            pointHoverBackgroundColor: '#7f1d1d'
                        },
                        {
                            label: 'IQAC Benchmark Target (4.0 / 5.0)',
                            data: labels.map(() => yoyData.target_benchmark || 4.0),
                            borderColor: '#10b981',
                            backgroundColor: '#10b981',
                            borderWidth: 2,
                            borderDash: [6, 6],
                            fill: false,
                            pointRadius: 0,
                            pointHoverRadius: 0,
                            tension: 0
                        }
                    ];
                } else {
                    // Multi-line by Parameter Group
                    const palette = [
                        '#b32b2b', '#0284c7', '#10b981', '#8b5cf6',
                        '#f59e0b', '#ec4899', '#0d9488', '#6366f1',
                        '#e11d48', '#84cc16'
                    ];

                    datasets = (yoyData.category_series || []).map((cat, idx) => {
                        const color = palette[idx % palette.length];
                        const dataVals = years.map(yr => {
                            return (cat.scores && cat.scores[yr] !== undefined && cat.scores[yr] !== null)
                                ? cat.scores[yr]
                                : null;
                        });

                        return {
                            label: cat.name,
                            data: dataVals,
                            borderColor: color,
                            backgroundColor: color,
                            borderWidth: 2.5,
                            fill: false,
                            tension: 0.3,
                            pointBackgroundColor: color,
                            pointBorderColor: '#ffffff',
                            pointBorderWidth: 2,
                            pointRadius: 4.5,
                            pointHoverRadius: 7,
                            spanGaps: true
                        };
                    });
                }

                return new Chart(canvas, {
                    type: 'line',
                    data: {
                        labels: labels,
                        datasets: datasets
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        layout: { padding: { top: 12, right: 20, bottom: 8, left: 10 } },
                        interaction: {
                            mode: 'index',
                            intersect: false
                        },
                        plugins: {
                            legend: {
                                display: true,
                                position: 'top',
                                labels: {
                                    boxWidth: 14,
                                    boxHeight: 14,
                                    usePointStyle: viewMode !== 'overall',
                                    font: { size: 12, weight: '500' },
                                    color: '#334155',
                                    padding: 16
                                }
                            },
                            tooltip: {
                                backgroundColor: 'rgba(15, 23, 42, 0.95)',
                                padding: 12,
                                cornerRadius: 8,
                                titleFont: { size: 13, weight: 'bold' },
                                bodyFont: { size: 12 },
                                callbacks: {
                                    label: (context) => {
                                        const val = context.raw;
                                        if (val === null || val === undefined) return `  ${context.dataset.label}: N/A`;
                                        const dsLabel = context.dataset.label;
                                        if (dsLabel.includes('Benchmark')) {
                                            return `  Target Benchmark: ${val.toFixed(2)} / 5.0`;
                                        }
                                        const idx = context.dataIndex;
                                        const item = yoyData.overall_series[idx] || {};
                                        let text = `  ${dsLabel}: ${val.toFixed(2)} / 5.0`;
                                        if (viewMode === 'overall') {
                                            text += ` (${item.percentage}%)`;
                                            if (item.yoy_score_change !== null && item.yoy_score_change !== undefined) {
                                                const sign = item.yoy_score_change > 0 ? '+' : '';
                                                text += ` | YoY: ${sign}${item.yoy_score_change} (${sign}${item.yoy_pct_change}%)`;
                                            }
                                            text += ` | Grade: ${item.grade}`;
                                        }
                                        return text;
                                    }
                                }
                            }
                        },
                        scales: {
                            x: {
                                grid: { display: false, drawBorder: false },
                                ticks: {
                                    font: { size: 12, weight: '600' },
                                    color: '#475569'
                                }
                            },
                            y: {
                                min: 0,
                                max: 5,
                                grid: { color: 'rgba(226, 232, 240, 0.7)', drawBorder: false },
                                ticks: {
                                    stepSize: 1,
                                    font: { size: 11 },
                                    color: '#64748b',
                                    callback: (v) => `${v}.0`
                                }
                            }
                        }
                    }
                });
            }

            function createYoYAuditTable(yoyData) {
                const tableWrap = document.createElement('div');
                tableWrap.className = 'chart-data-table-container';
                tableWrap.style.display = 'none';
                tableWrap.style.maxHeight = '330px';
                tableWrap.style.overflowY = 'auto';

                const table = document.createElement('table');
                table.className = 'chart-data-table';
                table.innerHTML = `
                    <thead>
                        <tr>
                            <th style="min-width: 140px; text-align: left;">Academic Year</th>
                            <th style="text-align: right; min-width: 120px;">Submissions</th>
                            <th style="text-align: right; min-width: 140px;">Avg Rating (/5.0)</th>
                            <th style="text-align: center; min-width: 160px;">NAAC / IQAC Grade</th>
                            <th style="text-align: right; min-width: 140px;">YoY Growth (±)</th>
                            <th style="text-align: center; min-width: 160px;">Benchmark Status</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${yoyData.overall_series.map(ys => {
                            let changeHtml = '<span style="color: #64748b; font-weight: 500;">— (Baseline)</span>';
                            if (ys.yoy_score_change !== null && ys.yoy_score_change !== undefined) {
                                if (ys.yoy_score_change > 0) {
                                    changeHtml = `<span style="color: #059669; font-weight: 600;">+${ys.yoy_score_change} (+${ys.yoy_pct_change}%) ↗</span>`;
                                } else if (ys.yoy_score_change < 0) {
                                    changeHtml = `<span style="color: #dc2626; font-weight: 600;">${ys.yoy_score_change} (${ys.yoy_pct_change}%) ↘</span>`;
                                } else {
                                    changeHtml = `<span style="color: #64748b; font-weight: 600;">0.00 (0.0%) →</span>`;
                                }
                            }

                            let gradeColor = '#059669';
                            let gradeBg = '#ecfdf5';
                            if (ys.score_5 < 3.0) {
                                gradeColor = '#dc2626';
                                gradeBg = '#fef2f2';
                            } else if (ys.score_5 < 3.5) {
                                gradeColor = '#d97706';
                                gradeBg = '#fffbeb';
                            } else if (ys.score_5 < 4.0) {
                                gradeColor = '#2563eb';
                                gradeBg = '#eff6ff';
                            }

                            const meetsTarget = ys.score_5 >= (yoyData.target_benchmark || 4.0);
                            const statusBadge = meetsTarget
                                ? '<span class="chart-badge" style="background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;">✅ Meets IQAC Target (≥4.0)</span>'
                                : '<span class="chart-badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">⚠️ Below Target (<4.0)</span>';

                            return `
                                <tr>
                                    <td><strong>${ys.label}</strong></td>
                                    <td style="text-align: right; font-weight: 600; color: #334155;">${ys.count} responses</td>
                                    <td style="text-align: right;"><strong style="font-size: 14.5px; color: #b32b2b;">${ys.score_5}</strong> <span style="font-size: 12px; color: #64748b;">(${ys.percentage}%)</span></td>
                                    <td style="text-align: center;"><span class="chart-badge" style="background: ${gradeBg}; color: ${gradeColor}; font-weight: 600;">${ys.grade}</span></td>
                                    <td style="text-align: right;">${changeHtml}</td>
                                    <td style="text-align: center;">${statusBadge}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                `;
                tableWrap.appendChild(table);
                return tableWrap;
            }

            function renderYoYTrendCard(yoyData) {
                if (!yoyData || !yoyData.has_multi_year) return null;

                const card = document.createElement('div');
                card.className = 'chart-card yoy-trend-card';
                card.dataset.section = 'yoy';
                yoyData._domCard = card;

                const headerBlock = document.createElement('div');
                headerBlock.className = 'chart-header-block';

                const topRow = document.createElement('div');
                topRow.className = 'chart-header-top-row';

                const title = document.createElement('div');
                title.className = 'chart-title';
                title.innerHTML = `<span>🏆</span> Multi-Year YoY Trend (NAAC / IQAC)`;
                topRow.appendChild(title);

                const actionBar = document.createElement('div');
                actionBar.className = 'card-action-bar';
                topRow.appendChild(actionBar);
                headerBlock.appendChild(topRow);

                const meta = document.createElement('div');
                meta.className = 'chart-meta';
                const firstYear = yoyData.years[0];
                const lastYear = yoyData.years[yoyData.years.length - 1];
                const trajBadge = yoyData.latest_trajectory === 'improving'
                    ? '<span class="chart-badge" style="background: #dcfce7; color: #166534; border: 1px solid #bbf7d0;">↗ Improving Quality Trajectory</span>'
                    : (yoyData.latest_trajectory === 'declining'
                        ? '<span class="chart-badge" style="background: #fee2e2; color: #991b1b; border: 1px solid #fecaca;">↘ Declining Trajectory</span>'
                        : '<span class="chart-badge" style="background: #f1f5f9; color: #475569; border: 1px solid #cbd5e1;">➡️ Stable Trajectory</span>');

                meta.innerHTML = `
                    <span class="chart-badge">📅 <strong>${yoyData.total_years}</strong> Academic Years (${firstYear} – ${lastYear})</span>
                    ${yoyData.highest_year ? `<span class="chart-badge" style="background: #fef3c7; color: #92400e; border: 1px solid #fde68a;">⭐ Peak Year: <strong>${yoyData.highest_year}</strong></span>` : ''}
                    <span class="chart-badge" style="background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;">🎯 IQAC Target: <strong>4.0 / 5.0</strong></span>
                    ${trajBadge}
                `;
                headerBlock.appendChild(meta);
                card.appendChild(headerBlock);

                const canvasContainer = document.createElement('div');
                canvasContainer.className = 'chart-container';
                canvasContainer.style.height = '330px';

                const canvas = document.createElement('canvas');
                canvasContainer.appendChild(canvas);
                card.appendChild(canvasContainer);

                let currentMode = 'overall'; // 'overall' | 'categories' | 'table'
                let currentChart = null;
                let tableContainer = null;

                function renderView() {
                    yoyData._currentMode = currentMode;

                    if (tableContainer) {
                        card.removeChild(tableContainer);
                        tableContainer = null;
                    }

                    if (currentMode === 'table') {
                        canvasContainer.style.display = 'none';
                        tableContainer = createYoYAuditTable(yoyData);
                        tableContainer.style.display = 'block';
                        card.appendChild(tableContainer);
                    } else {
                        canvasContainer.style.display = 'flex';
                        if (currentChart) {
                            currentChart.destroy();
                            currentChart = null;
                        }
                        currentChart = createYoYLineChart(canvas, yoyData, currentMode);
                        canvas.style.cursor = 'pointer';
                        canvas.title = "Click to enlarge";
                        canvas.onclick = () => {
                            if (window.openChartModal && currentChart) {
                                window.openChartModal(currentChart, 'Multi-Year Institutional Performance (YoY Trend)');
                            }
                        };
                    }

                    updateActionButtons();
                }

                function updateActionButtons() {
                    actionBar.innerHTML = '';

                    // 1. Overall Trajectory
                    const overallBtn = document.createElement('button');
                    overallBtn.className = 'card-action-btn' + (currentMode === 'overall' ? ' active' : '');
                    overallBtn.title = 'View Overall Rating Score Trajectory vs IQAC Target Benchmark';
                    overallBtn.innerHTML = `<span>🏛️</span><span>Overall Trajectory</span>`;
                    overallBtn.addEventListener('click', () => {
                        currentMode = 'overall';
                        renderView();
                    });
                    actionBar.appendChild(overallBtn);

                    // 2. By Parameter Group
                    if (yoyData.category_series && yoyData.category_series.length > 0) {
                        const catBtn = document.createElement('button');
                        catBtn.className = 'card-action-btn' + (currentMode === 'categories' ? ' active' : '');
                        catBtn.title = 'Compare Multiple Criteria / Parameter Groups Over Years';
                        catBtn.innerHTML = `<span>🔀</span><span>By Parameter Group</span>`;
                        catBtn.addEventListener('click', () => {
                            currentMode = 'categories';
                            renderView();
                        });
                        actionBar.appendChild(catBtn);
                    }

                    // 3. YoY Audit Table
                    const tableBtn = document.createElement('button');
                    tableBtn.className = 'card-action-btn' + (currentMode === 'table' ? ' active' : '');
                    tableBtn.title = 'View Accreditation Audit Table with Grades and YoY Changes';
                    tableBtn.innerHTML = `<span>📋</span><span>YoY Audit Table</span>`;
                    tableBtn.addEventListener('click', () => {
                        currentMode = 'table';
                        renderView();
                    });
                    actionBar.appendChild(tableBtn);
                }

                renderView();
                return card;
            }

            // ── Line Charts Section (Activity Timeline & Multi-Year YoY Trend in Same Row) ──
            if (selectedQuestionToView === 'all') {
                const hasTimeline = Boolean(data.submission_timeline && data.submission_timeline.has_timeline);
                const hasYoY = Boolean(data.yoy_trend && data.yoy_trend.has_multi_year);

                if (hasTimeline || hasYoY) {
                    const lineChartsRow = document.createElement('div');
                    lineChartsRow.className = 'analytics-line-charts-row' + (hasTimeline && hasYoY ? ' two-charts' : ' single-chart');

                    if (hasTimeline) {
                        const timelineCard = renderSubmissionTimelineCard(data.submission_timeline);
                        if (timelineCard) {
                            lineChartsRow.appendChild(timelineCard);
                        }
                    }

                    if (hasYoY) {
                        const yoyCard = renderYoYTrendCard(data.yoy_trend);
                        if (yoyCard) {
                            lineChartsRow.appendChild(yoyCard);
                        }
                    }

                    chartsWrapper.appendChild(lineChartsRow);
                }
            }

            // ── Main Render Loop (Active Questions) ─────────────────────────────────────────────
            if (selectedStatusToView === 'all' || selectedStatusToView === 'active') {
                data.groups.forEach((group, index) => {
                    let questionsToRender = group.questions.filter(q => q.active === 1 && hasQuestionResponses(q));
                    if (selectedQuestionToView !== 'all') {
                        questionsToRender = questionsToRender.filter(q => q.question === selectedQuestionToView);
                    }
                    if (questionsToRender.length === 0) return;

                    const isGrouped = !group.group_id.startsWith('ungrouped_') && questionsToRender.length > 1 && !isQuestionWiseMode;

                    if (isGrouped) {
                        renderGroupedStackedBar(group, questionsToRender, globalGrid, index * 0.1);
                    } else {
                        questionsToRender.forEach((q, qIndex) => {
                            const delay = (index * 0.1) + (qIndex * 0.05);
                            if (q.type === 'checkbox') {
                                renderMultipleChoiceBarChart(q, qIndex, globalGrid, delay);
                            } else {
                                renderSingleChoicePieChart(q, qIndex, globalGrid, delay);
                            }
                        });
                    }
                });

                if (globalGrid.children.length > 0) {
                    chartsWrapper.appendChild(globalCard);
                }

                // ── Comparative Group Analysis Section (Horizontal Stacked Bar) ──────
                if (data.comparative_groups && Array.isArray(data.comparative_groups) && data.comparative_groups.length > 0 && selectedQuestionToView === 'all') {
                    const compSection = document.createElement('div');
                    compSection.className = 'comparative-analytics-section';
                    compSection.style.marginTop = '44px';
                    compSection.style.marginBottom = '28px';

                    const compHeader = document.createElement('div');
                    compHeader.style.marginBottom = '20px';
                    compHeader.innerHTML = `
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
                            <div>
                                <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                                    <span>📊</span> Comparative Group Analysis (Horizontal Stacked Bar)
                                </h3>
                                <p style="margin: 4px 0 0 0; font-size: 13.5px; color: var(--text-secondary);">
                                    Side-by-side comparative rating breakdown for questions sharing identical rating & evaluation scales.
                                </p>
                            </div>
                            <span class="chart-badge" style="background: #eff6ff; color: #1e40af; border: 1px solid #bfdbfe; font-size: 13px; font-weight: 600;">
                                ${data.comparative_groups.length} Scale Groups Compared
                            </span>
                        </div>
                    `;
                    compSection.appendChild(compHeader);

                    const compGrid = document.createElement('div');
                    compGrid.className = 'charts-grid';
                    compGrid.style.display = 'flex';
                    compGrid.style.flexDirection = 'column';
                    compGrid.style.gap = '24px';

                    data.comparative_groups.forEach((compGroup, compIdx) => {
                        let questionsToRender = (compGroup.questions || []).filter(q => q.active === 1 && hasQuestionResponses(q));
                        if (questionsToRender.length > 1) {
                            renderGroupedStackedBar(compGroup, questionsToRender, compGrid, compIdx * 0.1);
                        }
                    });

                    if (compGrid.children.length > 0) {
                        compSection.appendChild(compGrid);
                        chartsWrapper.appendChild(compSection);
                    }
                }

                // Add Active Qualitative Comments
                if (data.qualitative_feedback) {
                    const activeFbKeys = Object.keys(data.qualitative_feedback).filter(k => {
                        const fb = data.qualitative_feedback[k];
                        return fb.active === 1 && fb.comments && fb.comments.length > 0;
                    });
                    if (activeFbKeys.length > 0) {
                        const activeQualCard = createQualitativeCard(
                            "Qualitative Suggestions & Open Feedback",
                            "Verbatim feedback and text responses submitted by stakeholders.",
                            activeFbKeys, data, false
                        );
                        if (activeQualCard) chartsWrapper.appendChild(activeQualCard);
                    }
                }
            }

            // ── Main Render Loop (Archived Questions) ─────────────────────────────────────────────
            if (selectedStatusToView === 'all' || selectedStatusToView === 'archived') {
                const archivedGrid = document.createElement('div');
                archivedGrid.className = 'charts-grid';

                data.groups.forEach((group, index) => {
                    let questionsToRender = group.questions.filter(q => q.active === 0 && hasQuestionResponses(q));
                    if (selectedQuestionToView !== 'all') {
                        questionsToRender = questionsToRender.filter(q => q.question === selectedQuestionToView);
                    }
                    if (questionsToRender.length === 0) return;

                    const isGrouped = !group.group_id.startsWith('ungrouped_') && questionsToRender.length > 1 && !isQuestionWiseMode;

                    if (isGrouped) {
                        renderGroupedStackedBar(group, questionsToRender, archivedGrid, index * 0.1);
                    } else {
                        questionsToRender.forEach((q, qIndex) => {
                            const delay = (index * 0.1) + (qIndex * 0.05);
                            if (q.type === 'checkbox') {
                                renderMultipleChoiceBarChart(q, qIndex, archivedGrid, delay);
                            } else {
                                renderSingleChoicePieChart(q, qIndex, archivedGrid, delay);
                            }
                        });
                    }
                });

                if (archivedGrid.children.length > 0) {
                    const archivedTitle = document.createElement('h3');
                    archivedTitle.textContent = "Archived Questions (Soft Deleted)";
                    archivedTitle.style.marginTop = "40px";
                    archivedTitle.style.marginBottom = "20px";
                    archivedTitle.style.color = "var(--text-secondary)";
                    archivedTitle.style.borderBottom = "2px solid #e2e8f0";
                    archivedTitle.style.paddingBottom = "10px";

                    const archivedCard = document.createElement('div');
                    archivedCard.className = 'card analytics-group';
                    archivedCard.style.borderTop = 'none';
                    archivedCard.style.padding = '0';
                    archivedCard.style.boxShadow = 'none';
                    archivedCard.style.backgroundColor = 'transparent';
                    archivedCard.appendChild(archivedGrid);

                    chartsWrapper.appendChild(archivedTitle);
                    chartsWrapper.appendChild(archivedCard);
                }

                // Render Archived Qualitative
                if (data.qualitative_feedback) {
                    const archivedFbKeys = Object.keys(data.qualitative_feedback).filter(k => {
                        const fb = data.qualitative_feedback[k];
                        return fb.active === 0 && fb.comments && fb.comments.length > 0;
                    });
                    if (archivedFbKeys.length > 0) {
                        const archivedQualCard = createQualitativeCard(
                            "Archived Qualitative Feedback",
                            "Verbatim responses for soft deleted questions.",
                            archivedFbKeys, data, true
                        );
                        if (archivedQualCard) chartsWrapper.appendChild(archivedQualCard);
                    }
                }
            }

            // ── Render Summary Tables for Common Option Sets ────────────────
            // To show grouped questions with avg rating and grade at the very end
            const summaryGroups = (data.comparative_groups && Array.isArray(data.comparative_groups) && data.comparative_groups.length > 0)
                ? data.comparative_groups
                : (data.groups || []).filter(g => !g.group_id.startsWith('ungrouped_'));

            if (summaryGroups.length > 0 && selectedQuestionToView === 'all') {
                const summaryHeading = document.createElement('div');
                summaryHeading.style.marginTop = '44px';
                summaryHeading.style.marginBottom = '20px';
                summaryHeading.innerHTML = `
                    <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 12px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px;">
                        <div>
                            <h3 style="margin: 0; font-size: 20px; font-weight: 700; color: var(--text-main); display: flex; align-items: center; gap: 8px;">
                                <span>📋</span> Evaluation Summary Tables (Rating Breakdown)
                            </h3>
                            <p style="margin: 4px 0 0 0; font-size: 13.5px; color: var(--text-secondary);">
                                Detailed tabulations of question scores, option distribution percentages, and performance grades.
                            </p>
                        </div>
                        <span class="chart-badge" style="background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; font-size: 13px; font-weight: 600;">
                            ${summaryGroups.length} Matrix Tables
                        </span>
                    </div>
                `;
                chartsWrapper.appendChild(summaryHeading);
            }

            summaryGroups.forEach((group) => {
                let questionsToRender = group.questions;

                if (selectedStatusToView === 'active') {
                    questionsToRender = questionsToRender.filter(q => q.active === 1);
                } else if (selectedStatusToView === 'archived') {
                    questionsToRender = questionsToRender.filter(q => q.active === 0);
                }

                if (selectedQuestionToView !== 'all') {
                    questionsToRender = questionsToRender.filter(q => q.question === selectedQuestionToView);
                }
                // Only process questions that actually collected responses
                questionsToRender = questionsToRender.filter(hasQuestionResponses);

                // Only process groups with multiple questions and a common option set
                if (questionsToRender.length <= 1) return;
                if (!data.comparative_groups && group.group_id.startsWith('ungrouped_')) return;

                // Get all options
                let allOptions = group.options && group.options.length > 0 ? group.options : [];
                if (allOptions.length === 0) {
                    const optSet = new Set();
                    questionsToRender.forEach(q => Object.keys(q.tallies || {}).forEach(k => optSet.add(k)));
                    allOptions = Array.from(optSet);
                }
                if (allOptions.length === 0) return;

                // Determine if the group is scorable based on backend provided weighted_score
                const isScorable = questionsToRender.some(q => q.weighted_score !== undefined);

                const tableWrap = document.createElement('div');
                tableWrap.className = 'summary-table-wrap';
                tableWrap.style.marginTop = '24px';
                tableWrap.style.marginBottom = '32px';
                tableWrap.style.width = '100%';
                tableWrap.style.overflowX = 'auto';
                tableWrap.style.backgroundColor = '#fff';
                tableWrap.style.borderRadius = '8px';
                tableWrap.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.05)';
                tableWrap.style.border = '1px solid #cbd5e1';

                if (group.group_name) {
                    const groupHeader = document.createElement('div');
                    groupHeader.style.padding = '14px 18px';
                    groupHeader.style.background = '#f8fafc';
                    groupHeader.style.borderBottom = '1px solid #cbd5e1';
                    groupHeader.style.display = 'flex';
                    groupHeader.style.alignItems = 'center';
                    groupHeader.style.justifyContent = 'space-between';
                    groupHeader.innerHTML = `
                        <div style="font-size: 15px; font-weight: 700; color: #1e293b; display: flex; align-items: center; gap: 8px;">
                            <span>📊</span> ${group.group_name}
                        </div>
                        <span style="font-size: 12.5px; color: #475569; font-weight: 600; background: #e2e8f0; padding: 3px 10px; border-radius: 12px;">
                            ${questionsToRender.length} Questions
                        </span>
                    `;
                    tableWrap.appendChild(groupHeader);
                }

                const table = document.createElement('table');
                table.className = 'analytics-table';
                table.style.width = '100%';
                table.style.borderCollapse = 'collapse';

                const thead = document.createElement('thead');
                let headHTML = `<tr>
                <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: center; background: #f1f5f9; color: #334155; width: 60px; font-size: 13.5px;">Q.No</th>
                <th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: left; background: #f1f5f9; color: #334155; min-width: 250px; font-size: 13.5px;">Question</th>`;
                allOptions.forEach(opt => {
                    headHTML += `<th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: center; background: #f1f5f9; color: #334155; white-space: nowrap; font-size: 13.5px;">${opt}</th>`;
                });
                if (isScorable) {
                    headHTML += `<th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: center; background: #f1f5f9; color: #334155; white-space: nowrap; font-size: 13.5px;">Avg. Rating</th>`;
                    headHTML += `<th style="padding: 10px 12px; border-bottom: 2px solid #cbd5e1; text-align: center; background: #f1f5f9; color: #334155; white-space: nowrap; font-size: 13.5px;">Grade</th>`;
                }
                headHTML += `</tr>`;
                thead.innerHTML = headHTML;
                table.appendChild(thead);

                const tbody = document.createElement('tbody');
                questionsToRender.forEach((q, qIndex) => {
                    let trHTML = `<tr>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; font-weight: 600; color: #475569; font-size: 13.5px; background: #fff;">Q${qIndex + 1}</td>
                    <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-weight: 500; color: #1e293b; border-right: 1px solid #e2e8f0; font-size: 13.5px; background: #fff;">${q.question}</td>`;

                    allOptions.forEach(opt => {
                        const count = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                        const pct = q.total_answered > 0 ? ((count / q.total_answered) * 100).toFixed(1) : 0;
                        trHTML += `<td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #0369a1; border-right: 1px solid #f1f5f9; font-size: 13.5px; background: #fff;">${pct}%</td>`;
                    });

                    if (isScorable) {
                        let rawPctScore = q.score_percentage !== undefined ? q.score_percentage : 0;

                        // Convert any scale to a 5-point scale based on percentage
                        let avgRating = (rawPctScore / 100) * 5;

                        let grade = 'N/A';
                        let badgeBg = '#f1f5f9';
                        let badgeText = '#64748b';
                        let trendIcon = '';
                        const svgUpGreen = `<svg style="width:20px;height:20px;margin-right:6px;color:#16a34a;vertical-align:text-bottom;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M3 17l6-6 4 4 8-8m0 0v6m0-6h-6"></path></svg>`;
                        const svgUpBlue = `<svg style="width:20px;height:20px;margin-right:6px;color:#0284c7;vertical-align:text-bottom;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M3 17l6-6 4 4 8-8m0 0v6m0-6h-6"></path></svg>`;
                        const svgDownRed = `<svg style="width:20px;height:20px;margin-right:6px;color:#dc2626;vertical-align:text-bottom;" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="3.5" d="M3 7l6 6 4-4 8 8m0 0v-6m0 6h-6"></path></svg>`;
                        if (rawPctScore > 0 || q.weighted_score > 0) {
                            if (avgRating >= 4) {
                                grade = 'Excellent';
                                badgeBg = '#dcfce7';
                                badgeText = '#166534';
                                trendIcon = svgUpGreen;
                            } else if (avgRating >= 3.5 && avgRating < 4) {
                                grade = 'Very Good';
                                badgeBg = '#dcfce7';
                                badgeText = '#166534';
                                trendIcon = svgUpGreen;
                            } else if (avgRating >= 3 && avgRating < 3.5) {
                                grade = 'Good';
                                badgeBg = '#e0f2fe';
                                badgeText = '#075985';
                                trendIcon = svgUpBlue;
                            } else {
                                grade = 'Average';
                                badgeBg = '#fee2e2';
                                badgeText = '#991b1b';
                                trendIcon = svgDownRed;
                            }
                        }

                        let formattedRating = avgRating > 0 ? (Number.isInteger(avgRating) ? avgRating : parseFloat(avgRating.toFixed(3))) : '-';

                        trHTML += `<td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; color: #0f172a; border-left: 1px solid #e2e8f0; font-weight: 600; font-size: 14.5px; background: #fff; white-space: nowrap; vertical-align: middle;">
                            ${trendIcon}<span style="font-weight: 700;">${formattedRating}</span>
                        </td>`;
                        trHTML += `<td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; text-align: center; border-left: 1px solid #f1f5f9; font-size: 13px; background: #fff;">
                        <span style="background-color: ${badgeBg}; color: ${badgeText}; padding: 4px 10px; border-radius: 20px; font-weight: 600; display: inline-block;">${grade}</span>
                    </td>`;
                    }

                    trHTML += `</tr>`;
                    tbody.innerHTML += trHTML;
                });
                table.appendChild(tbody);
                tableWrap.appendChild(table);

                chartsWrapper.appendChild(tableWrap);
            });

            if (chartsWrapper.children.length === 0) {
                chartsWrapper.innerHTML = '<div class="card"><p class="no-data" style="margin: 40px 0;">No responses have been collected for the questions in this view.</p></div>';
            }
        }

        // Filter UI elements
        const filterCard = document.getElementById('filter-card');
        const filtersContainer = document.getElementById('filters-container');
        const yearSelector = document.getElementById('year-selector');
        const applyBtn = document.getElementById('apply-filters-btn');
        const clearBtn = document.getElementById('clear-filters-btn');

        let currentFilterableQuestions = {};
        let activeFiltersData = {};
        let currentActiveFormId = null;

        // Function to fetch data
        function fetchAnalytics(formId = 0) {
            loadingOverlay.style.display = 'flex';

            // Read filters from URL
            const urlParams = new URLSearchParams(window.location.search);
            const year = urlParams.get('year') || '';
            const filtersJson = urlParams.get('filters') || '{}';
            const dateFrom = urlParams.get('date_from') || '';
            const dateTo = urlParams.get('date_to') || '';

            try {
                activeFiltersData = JSON.parse(filtersJson);
            } catch (e) {
                activeFiltersData = {};
            }

            // Update URL without reloading page (for form ID)
            const url = new URL(window.location);
            // If form changed, reset cached filter options
            if (formId != currentActiveFormId) {
                currentActiveFormId = formId;
                currentFilterableQuestions = {};
                document.querySelectorAll('.dynamic-filter-group').forEach(el => el.remove());
                const yc = document.getElementById('year-filter-options');
                if (yc) yc.innerHTML = '';
            }

            if (formId) url.searchParams.set('form_id', formId);
            window.history.pushState({}, '', url);

            if (!formId || formId == 0) {
                document.getElementById('analytics-select-form-view').style.display = 'block';
                document.getElementById('analytics-dashboard-view').style.display = 'none';
            } else {
                document.getElementById('analytics-select-form-view').style.display = 'none';
                document.getElementById('analytics-dashboard-view').style.display = 'block';
            }

            fetch(`../analytics/fetch_analytics.php?form_id=${formId}&year=${encodeURIComponent(year)}&filters=${encodeURIComponent(filtersJson)}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`)
                .then(response => response.json())
                .then(data => {
                    loadingOverlay.style.display = 'none';
                    if (!data.success) {
                        const errorMsg = data.error || data.message || 'Unknown Error';
                        console.error('Data Error:', errorMsg);
                        if (chartsWrapper) {
                            chartsWrapper.innerHTML = '<div style="color: #ef4444; padding: 24px; text-align: center; font-weight: 500;">Failed to load data: ' + errorMsg + '</div>';
                        }
                        if (toggleModeBtn) toggleModeBtn.style.display = 'none';
                        return;
                    }

                    currentData = data;
                    if (toggleModeBtn && formId != 0 && data.summary && data.summary.total_responses > 0) {
                        toggleModeBtn.style.display = 'flex';
                    } else if (toggleModeBtn) {
                        toggleModeBtn.style.display = 'none';
                    }

                    // Populate Forms Grid
                    const formsGrid = document.getElementById('analytics-forms-grid');
                    if (formsGrid && data.forms) {
                        // Always re-populate if data is present to prevent being stuck on "Loading forms..."
                        formsGrid.innerHTML = '';
                        if (data.forms.length === 0) {
                            formsGrid.innerHTML = '<p style="text-align: center; color: var(--text-secondary); grid-column: 1 / -1;">No forms found.</p>';
                        } else {
                            data.forms.forEach(f => {
                                const item = document.createElement('div');
                                item.className = 'form-card-container';

                                let qrHTML = `
                                <svg class="placeholder-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                              `;
                                if (f.qr_image_path) {
                                    qrHTML = `<img src="../${f.qr_image_path}" alt="QR Code">`;
                                }

                                item.innerHTML = `
                                <div class="form-card-front">
                                  <!-- Official Logo Header -->
                                  <div class="card-official-header">
                                    <div class="card-logos">
                                      <img src="../images/vignan's_logo.png" alt="Vignan Logo" class="logo-vignan">
                                      <img src="../images/iqac_logo.png" alt="IQAC Logo" class="logo-iqac">
                                    </div>
                                    <div class="header-divider"></div>
                                    <h3 class="card-bright-title">${f.title}</h3>
                                  </div>

                                  <!-- QR Code Area -->
                                  <div class="front-qr-section">
                                    <div class="qr-viewfinder">
                                      <div class="scanner-line"></div>
                                      ${qrHTML}
                                    </div>
                                  </div>

                                  <!-- Footer Info (Analytics Module) -->
                                  <div class="front-footer">
                                    <div class="footer-left">
                                      <strong class="footer-office">Office of IQAC,<br>VFSTR</strong>
                                    </div>
                                    <div class="footer-right analyze-form-btn" data-id="${f.id}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px;">
                                      <span class="footer-module-title">Analytics</span>
                                      <span style="font-size: 11px; opacity: 0.85; display: flex; align-items: center; gap: 4px; font-weight: 500; letter-spacing: 0.5px;">
                                        Click me <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3"></path></svg>
                                      </span>
                                    </div>
                                  </div>
                                </div>
                                `;
                                formsGrid.appendChild(item);
                            });
                        }
                        formsGrid.setAttribute('data-loaded', 'true');

                        document.querySelectorAll('.analyze-form-btn').forEach(btn => {
                            btn.addEventListener('click', function () {
                                const id = this.getAttribute('data-id');
                                const cardTitle = this.closest('.form-card-container')?.querySelector('.card-bright-title')?.textContent?.trim() || 'Unknown Form';
                                startFormSession(id, cardTitle);

                                document.getElementById('analytics-select-form-view').style.display = 'none';
                                document.getElementById('analytics-dashboard-view').style.display = 'block';

                                currentFilterableQuestions = {};
                                selectedQuestionToView = 'all';
                                if (questionSelector) questionSelector.value = 'all';
                                document.querySelectorAll('.dynamic-filter-group').forEach(el => el.remove());
                                const url = new URL(window.location);
                                url.searchParams.delete('year');
                                url.searchParams.delete('filters');
                                window.history.pushState({}, '', url);

                                fetchAnalytics(id);
                            });
                        });
                    }

                    // Populate Question Selector
                    if (questionSelector) {
                        questionSelector.innerHTML = '<option value="all" selected>All Questions</option>';
                        let hasQuestions = false;
                        data.groups.forEach(group => {
                            group.questions.forEach(q => {
                                if (!hasQuestionResponses(q)) return;
                                hasQuestions = true;
                                const option = document.createElement('option');
                                option.value = q.question; // using full text as value
                                // Truncate long text for display in dropdown
                                option.textContent = q.question.length > 80 ? q.question.substring(0, 80) + '...' : q.question;
                                if (q.question === selectedQuestionToView) option.selected = true;
                                questionSelector.appendChild(option);
                            });
                        });

                        if (selectedQuestionToView !== 'all' && !Array.from(questionSelector.options).some(o => o.value === selectedQuestionToView)) {
                            selectedQuestionToView = 'all';
                            questionSelector.value = 'all';
                        }

                        if (hasQuestions && isQuestionWiseMode) {
                            questionSelectorContainer.style.display = 'flex';
                        } else {
                            questionSelectorContainer.style.display = 'none';
                        }
                    }

                    // Show Sidebar open button is already present, just hide it if needed
                    // Actually filter button is always visible now.

                    // Populate Year Checkboxes
                    const yearContainer = document.getElementById('year-filter-options');
                    if (yearContainer) {
                        if (formId == 0) {
                            yearContainer.innerHTML = '';
                        } else if (data.available_years) {
                            const activeYears = new Set();
                            if (year) {
                                year.split(',').forEach(y => {
                                    const trimmed = y.trim();
                                    if (trimmed) activeYears.add(trimmed);
                                });
                            }

                            yearContainer.innerHTML = '';
                            if (data.available_years.length === 0) {
                                yearContainer.innerHTML = '<span style="font-size: 13px; color: var(--text-secondary); padding: 4px 0; display: block;">No submission years available</span>';
                            } else {
                                data.available_years.forEach(y => {
                                    const lbl = document.createElement('label');
                                    lbl.className = 'checkbox-label';
                                    const cb = document.createElement('input');
                                    cb.type = 'checkbox';
                                    cb.value = y;
                                    cb.dataset.filterType = 'year';
                                    if (activeYears.has(String(y))) cb.checked = true;
                                    lbl.appendChild(cb);
                                    lbl.appendChild(document.createTextNode(' ' + y));
                                    yearContainer.appendChild(lbl);
                                });
                            }
                        }
                    }

                    // Populate Dynamic Question Checkboxes
                    const filtersContainer = document.getElementById('filters-container');
                    if (data.filterable_questions && Object.keys(currentFilterableQuestions).length === 0) {
                        currentFilterableQuestions = data.filterable_questions;

                        // Remove any existing dynamic filters
                        document.querySelectorAll('.dynamic-filter-accordion').forEach(el => el.remove());

                        Object.keys(currentFilterableQuestions).forEach(qText => {
                            const accordionDiv = document.createElement('div');
                            accordionDiv.className = 'filter-accordion dynamic-filter-accordion';

                            const btn = document.createElement('button');
                            btn.className = 'filter-accordion-btn';
                            btn.textContent = qText.length > 30 ? qText.substring(0, 30) + '...' : qText;
                            btn.onclick = function () {
                                this.classList.toggle('active');
                                const content = this.nextElementSibling;
                                content.style.display = content.style.display === 'block' ? 'none' : 'block';
                            };
                            accordionDiv.appendChild(btn);

                            const contentDiv = document.createElement('div');
                            contentDiv.className = 'filter-accordion-content';
                            contentDiv.style.display = 'none';

                            const groupDiv = document.createElement('div');
                            groupDiv.className = 'checkbox-group';

                            currentFilterableQuestions[qText].forEach(optVal => {
                                const lbl = document.createElement('label');
                                lbl.className = 'checkbox-label';

                                const cb = document.createElement('input');
                                cb.type = 'checkbox';
                                cb.value = optVal;
                                cb.dataset.qtext = qText;

                                // activeFiltersData[qText] can be an array now
                                if (activeFiltersData[qText] && Array.isArray(activeFiltersData[qText])) {
                                    if (activeFiltersData[qText].includes(optVal)) cb.checked = true;
                                } else if (activeFiltersData[qText] === optVal) {
                                    cb.checked = true;
                                }

                                lbl.appendChild(cb);
                                lbl.appendChild(document.createTextNode(optVal));
                                groupDiv.appendChild(lbl);
                            });

                            contentDiv.appendChild(groupDiv);
                            accordionDiv.appendChild(contentDiv);
                            filtersContainer.appendChild(accordionDiv);
                        });
                    }

                    renderDashboard(data);
                    updateDateFilterUI(data.applied_date_filter, dateFrom, dateTo, data.summary ? data.summary.total_responses : 0);
                })
                .catch(error => {
                    loadingOverlay.style.display = 'none';
                    console.error('Error fetching analytics:', error);
                    console.error('Error fetching analytics:', error);
                    if (chartsWrapper) {
                        chartsWrapper.innerHTML = '<div style="color: #ef4444; padding: 24px; text-align: center; font-weight: 500;">Unable to load charts. (' + error.message + ')</div>';
                    }
                });
        }

        // Sidebar Toggle Logic
        const sidebar = document.getElementById('filter-sidebar');
        const overlay = document.getElementById('filter-overlay');

        document.getElementById('open-filters-btn')?.addEventListener('click', function () {
            sidebar.classList.add('open');
            overlay.classList.add('active');
        });

        // Expose close logic globally for cross-module access
        window.closeAnalyticsSidebar = function () {
            if (sidebar) sidebar.classList.remove('open');
            if (overlay) overlay.classList.remove('active');
        };

        function closeSidebar() {
            window.closeAnalyticsSidebar();
        }

        document.getElementById('close-filters-btn')?.addEventListener('click', closeSidebar);
        overlay?.addEventListener('click', closeSidebar);

        // Accordion Toggle for statically rendered ones (like Submission Year)
        document.querySelectorAll('.filter-accordion-btn').forEach(btn => {
            btn.onclick = function () {
                this.classList.toggle('active');
                const content = this.nextElementSibling;
                if (content) content.style.display = content.style.display === 'block' ? 'none' : 'block';
            };
        });


        applyBtn?.addEventListener('click', function () {
            const url = new URL(window.location);
            let filterParts = [];

            // Handle Year filter
            const yearCheckboxes = document.querySelectorAll('#year-filter-options input[type="checkbox"]:checked');
            if (yearCheckboxes.length > 0) {
                const selectedYears = Array.from(yearCheckboxes).map(cb => cb.value.trim());
                url.searchParams.set('year', selectedYears.join(','));
                filterParts.push(`Year: [${selectedYears.join(', ')}]`);
            } else {
                url.searchParams.delete('year');
            }

            const filterPayload = {};
            let hasFilters = false;

            // Gather dynamic checkboxes
            document.querySelectorAll('.dynamic-filter-accordion input[type="checkbox"]:checked').forEach(cb => {
                const qtext = cb.dataset.qtext;
                if (!filterPayload[qtext]) {
                    filterPayload[qtext] = [];
                }
                filterPayload[qtext].push(cb.value);
                hasFilters = true;
            });

            if (hasFilters) {
                url.searchParams.set('filters', JSON.stringify(filterPayload));
                Object.keys(filterPayload).forEach(k => {
                    const shortK = k.length > 25 ? k.substring(0, 25) + '...' : k;
                    filterParts.push(`'${shortK}': [${filterPayload[k].join(', ')}]`);
                });
            } else {
                url.searchParams.delete('filters');
            }

            if (filterParts.length > 0) {
                recordAnalyticsOperation(`Applied Filters (${filterParts.join(' | ')})`);
            } else {
                recordAnalyticsOperation(`Cleared Filters`);
            }

            const urlParams = new URLSearchParams(window.location.search);
            const currentFormId = urlParams.get('form_id');
            window.history.pushState({}, '', url);

            closeSidebar();
            fetchAnalytics(currentFormId);
        });

        clearBtn?.addEventListener('click', function () {
            document.querySelectorAll('#filter-sidebar input[type="checkbox"]').forEach(cb => {
                cb.checked = false;
            });

            const url = new URL(window.location);
            url.searchParams.delete('year');
            url.searchParams.delete('filters');

            const currentFormId = url.searchParams.get('form_id');
            window.history.pushState({}, '', url);

            closeSidebar();
            fetchAnalytics(currentFormId);
        });

        // ── Flexible Segmented Date Range (DD-MM-YYYY, MM-YYYY, YYYY) Filter Logic ─
        const applyDateBtn = document.getElementById('apply-date-range-btn');
        const resetDateBtn = document.getElementById('reset-date-range-btn');
        const dateFilterBanner = document.getElementById('date-filter-status-banner');
        const dateFilterDesc = document.getElementById('date-filter-status-desc');
        const dateFilterClearBannerBtn = document.getElementById('date-filter-clear-banner-btn');
        const dateRangeErrorDiv = document.getElementById('date-range-error-msg');
        const dateRangeErrorContent = document.getElementById('date-range-error-text-content');
        const boxFrom = document.getElementById('seg-box-from');
        const boxTo = document.getElementById('seg-box-to');
        let dateRangeErrorTimer = null;

        function clearDateRangeError() {
            if (dateRangeErrorTimer) {
                clearTimeout(dateRangeErrorTimer);
                dateRangeErrorTimer = null;
            }
            if (dateRangeErrorDiv) {
                dateRangeErrorDiv.classList.remove('fade-out');
                dateRangeErrorDiv.style.display = 'none';
            }
            if (boxFrom) boxFrom.classList.remove('has-error', 'shake');
            if (boxTo) boxTo.classList.remove('has-error', 'shake');
        }

        function showDateRangeError(msg, targetBox = 'both') {
            if (dateRangeErrorTimer) {
                clearTimeout(dateRangeErrorTimer);
                dateRangeErrorTimer = null;
            }

            if (dateRangeErrorDiv && dateRangeErrorContent) {
                dateRangeErrorContent.textContent = msg;
                dateRangeErrorDiv.classList.remove('fade-out');
                dateRangeErrorDiv.style.display = 'inline-flex';
                dateRangeErrorDiv.classList.remove('shake');
                void dateRangeErrorDiv.offsetWidth;
                dateRangeErrorDiv.classList.add('shake');
                setTimeout(() => {
                    if (dateRangeErrorDiv) dateRangeErrorDiv.classList.remove('shake');
                }, 400);
            }
            if (targetBox === 'from' || targetBox === 'both') {
                if (boxFrom) {
                    boxFrom.classList.add('has-error', 'shake');
                    setTimeout(() => boxFrom.classList.remove('shake'), 400);
                }
            }
            if (targetBox === 'to' || targetBox === 'both') {
                if (boxTo) {
                    boxTo.classList.add('has-error', 'shake');
                    setTimeout(() => boxTo.classList.remove('shake'), 400);
                }
            }

            // Auto-hide error after 2 seconds with a smooth fade-out
            dateRangeErrorTimer = setTimeout(() => {
                if (dateRangeErrorDiv && dateRangeErrorDiv.style.display !== 'none') {
                    dateRangeErrorDiv.classList.add('fade-out');
                    setTimeout(() => {
                        if (dateRangeErrorDiv) {
                            dateRangeErrorDiv.style.display = 'none';
                            dateRangeErrorDiv.classList.remove('fade-out');
                        }
                        if (boxFrom) boxFrom.classList.remove('has-error');
                        if (boxTo) boxTo.classList.remove('has-error');
                    }, 250);
                }
            }, 2000);
        }

        // Validate individual segment (from / to)
        function parseAndValidateSegment(prefix) {
            const dayInput = document.getElementById(`${prefix}-day`);
            const monthInput = document.getElementById(`${prefix}-month`);
            const yearInput = document.getElementById(`${prefix}-year`);

            const dRaw = (dayInput?.value || '').trim();
            const mRaw = (monthInput?.value || '').trim();
            const yRaw = (yearInput?.value || '').trim();

            const hasDay = dRaw !== '';
            const hasMonth = mRaw !== '';
            const hasYear = yRaw !== '';

            // 1. Completely empty
            if (!hasDay && !hasMonth && !hasYear) {
                return { status: 'empty', raw: '' };
            }

            // 2. Year must be present if anything is entered
            if (!hasYear) {
                if (hasDay && hasMonth) {
                    return { status: 'invalid', error: `Please enter 4-digit Year along with Day and Month in '${prefix.toUpperCase()}'.`, target: prefix };
                } else if (hasDay) {
                    return { status: 'invalid', error: `Day cannot be entered alone in '${prefix.toUpperCase()}'. Year is required.`, target: prefix };
                } else {
                    return { status: 'invalid', error: `Month cannot be entered alone in '${prefix.toUpperCase()}'. Year is required.`, target: prefix };
                }
            }

            // Validate year format
            if (!/^\d{4}$/.test(yRaw)) {
                return { status: 'invalid', error: `Please enter a valid 4-digit Year (e.g. 2024) in '${prefix.toUpperCase()}'.`, target: prefix };
            }
            const y = parseInt(yRaw, 10);
            if (y < 1900 || y > 2100) {
                return { status: 'invalid', error: `Year in '${prefix.toUpperCase()}' must be between 1900 and 2100.`, target: prefix };
            }

            // 3. Year only mode (No day, no month)
            if (!hasDay && !hasMonth) {
                return {
                    status: 'year',
                    year: y,
                    value: String(y),
                    raw: yRaw
                };
            }

            // 4. Month + Year mode (Month present, no day)
            if (!hasDay && hasMonth) {
                if (!/^\d{1,2}$/.test(mRaw)) {
                    return { status: 'invalid', error: `Please enter a valid numeric Month (01-12) in '${prefix.toUpperCase()}'.`, target: prefix };
                }
                const m = parseInt(mRaw, 10);
                if (m < 1 || m > 12) {
                    return { status: 'invalid', error: `Month in '${prefix.toUpperCase()}' must be between 01 and 12.`, target: prefix };
                }
                const formattedM = String(m).padStart(2, '0');
                return {
                    status: 'month_year',
                    year: y,
                    month: m,
                    value: `${formattedM}-${y}`,
                    raw: `${formattedM}-${y}`
                };
            }

            // 5. Day + Month + Year mode (All present)
            if (hasDay && hasMonth) {
                if (!/^\d{1,2}$/.test(mRaw)) {
                    return { status: 'invalid', error: `Please enter a valid numeric Month (01-12) in '${prefix.toUpperCase()}'.`, target: prefix };
                }
                const m = parseInt(mRaw, 10);
                if (m < 1 || m > 12) {
                    return { status: 'invalid', error: `Month in '${prefix.toUpperCase()}' must be between 01 and 12.`, target: prefix };
                }

                if (!/^\d{1,2}$/.test(dRaw)) {
                    return { status: 'invalid', error: `Please enter a valid numeric Day in '${prefix.toUpperCase()}'.`, target: prefix };
                }
                const d = parseInt(dRaw, 10);
                const daysInMonth = new Date(y, m, 0).getDate();
                if (d < 1 || d > daysInMonth) {
                    return { status: 'invalid', error: `Day in '${prefix.toUpperCase()}' must be between 01 and ${daysInMonth} for ${String(m).padStart(2, '0')}/${y}.`, target: prefix };
                }

                const formattedD = String(d).padStart(2, '0');
                const formattedM = String(m).padStart(2, '0');
                return {
                    status: 'full_date',
                    year: y,
                    month: m,
                    day: d,
                    value: `${formattedD}-${formattedM}-${y}`,
                    raw: `${formattedD}-${formattedM}-${y}`
                };
            }

            // 6. Day + Year but missing Month
            if (hasDay && !hasMonth) {
                return { status: 'invalid', error: `Please enter Month between Day and Year in '${prefix.toUpperCase()}'.`, target: prefix };
            }

            return { status: 'invalid', error: `Invalid date entry in '${prefix.toUpperCase()}'.`, target: prefix };
        }

        // Validate complete Date Range combination (Granularity match + Chronological range)
        function validateDateRangeInputs() {
            clearDateRangeError();

            const fromResult = parseAndValidateSegment('from');
            const toResult = parseAndValidateSegment('to');

            // 1. Both empty -> Valid reset state
            if (fromResult.status === 'empty' && toResult.status === 'empty') {
                return { valid: true, isEmpty: true, fromVal: '', toVal: '' };
            }

            // 2. One empty, one filled
            if (fromResult.status === 'empty' && toResult.status !== 'empty') {
                showDateRangeError("Please fill both 'From' and 'To' dates.", 'from');
                return { valid: false };
            }
            if (toResult.status === 'empty' && fromResult.status !== 'empty') {
                showDateRangeError("Please fill both 'From' and 'To' dates.", 'to');
                return { valid: false };
            }

            // 3. Individual format validation errors
            if (fromResult.status === 'invalid') {
                showDateRangeError(fromResult.error, 'from');
                return { valid: false };
            }
            if (toResult.status === 'invalid') {
                showDateRangeError(toResult.error, 'to');
                return { valid: false };
            }

            // 4. Granularity Matching Rule (Both must be Year, Month-Year, or Full Date)
            if (fromResult.status !== toResult.status) {
                const formatLabels = {
                    year: 'Year only (YYYY)',
                    month_year: 'Month-Year (MM-YYYY)',
                    full_date: 'Full Date (DD-MM-YYYY)'
                };
                const fromLabel = formatLabels[fromResult.status] || fromResult.status;
                const toLabel = formatLabels[toResult.status] || toResult.status;
                showDateRangeError(`Mismatched date formats! 'From' is ${fromLabel} but 'To' is ${toLabel}. Both must have matching formats.`, 'both');
                return { valid: false };
            }

            // 5. Chronological Order ("To" >= "From" Rule)
            // Mode A: Year only
            if (fromResult.status === 'year') {
                if (toResult.year < fromResult.year) {
                    showDateRangeError(`'To' year (${toResult.year}) cannot be earlier than 'From' year (${fromResult.year}).`, 'to');
                    return { valid: false };
                }
            }

            // Mode B: Month-Year
            if (fromResult.status === 'month_year') {
                if (toResult.year < fromResult.year) {
                    showDateRangeError(`'To' year (${toResult.year}) cannot be earlier than 'From' year (${fromResult.year}).`, 'to');
                    return { valid: false };
                }
                if (toResult.year === fromResult.year && toResult.month < fromResult.month) {
                    showDateRangeError(`'To' month cannot be earlier than 'From' month for year ${fromResult.year}.`, 'to');
                    return { valid: false };
                }
            }

            // Mode C: Full Date
            if (fromResult.status === 'full_date') {
                const fromDate = new Date(fromResult.year, fromResult.month - 1, fromResult.day);
                const toDate = new Date(toResult.year, toResult.month - 1, toResult.day);
                if (toDate < fromDate) {
                    showDateRangeError(`'To' date (${toResult.value}) cannot be earlier than 'From' date (${fromResult.value}).`, 'to');
                    return { valid: false };
                }
            }

            return {
                valid: true,
                isEmpty: false,
                fromVal: fromResult.value,
                toVal: toResult.value
            };
        }

        // Extract date string from segmented input boxes:
        // - if full date: "DD-MM-YYYY"
        // - if month & year: "MM-YYYY"
        // - if only year: "YYYY"
        function getDateFromSegments(prefix) {
            const d = (document.getElementById(`${prefix}-day`)?.value || '').trim();
            const m = (document.getElementById(`${prefix}-month`)?.value || '').trim();
            const y = (document.getElementById(`${prefix}-year`)?.value || '').trim();

            if (!y && !m && !d) return '';

            // Full Date
            if (d && m && y) {
                return `${d.padStart(2, '0')}-${m.padStart(2, '0')}-${y}`;
            }
            // Month + Year
            if (m && y) {
                return `${m.padStart(2, '0')}-${y}`;
            }
            // Year Only
            if (y) {
                return `${y}`;
            }
            return '';
        }

        // Populate segmented input boxes from string (YYYY-MM-DD, DD-MM-YYYY, MM-YYYY, or YYYY)
        function populateSegments(prefix, dateStr) {
            const dayInput = document.getElementById(`${prefix}-day`);
            const monthInput = document.getElementById(`${prefix}-month`);
            const yearInput = document.getElementById(`${prefix}-year`);
            const picker = document.getElementById(`native-picker-${prefix}`);
            if (!dayInput || !monthInput || !yearInput) return;

            if (!dateStr) {
                dayInput.value = '';
                monthInput.value = '';
                yearInput.value = '';
                if (picker) picker.value = '';
                return;
            }

            let s = String(dateStr).trim();
            s = s.replace(/\bdd\b|\bmm\b/gi, '').replace(/^[\/\-\.]+|[\/\-\.]+$/g, '').trim();

            // 1. Full Date YYYY-MM-DD
            const isoMatch = s.match(/^(\d{4})[-\/.](\d{1,2})[-\/.](\d{1,2})$/);
            if (isoMatch) {
                yearInput.value = isoMatch[1];
                monthInput.value = isoMatch[2].padStart(2, '0');
                dayInput.value = isoMatch[3].padStart(2, '0');
                if (picker) picker.value = `${isoMatch[1]}-${monthInput.value}-${dayInput.value}`;
                return;
            }

            // 2. Full Date DD-MM-YYYY
            const dmyMatch = s.match(/^(\d{1,2})[-\/.](\d{1,2})[-\/.](\d{4})$/);
            if (dmyMatch) {
                dayInput.value = dmyMatch[1].padStart(2, '0');
                monthInput.value = dmyMatch[2].padStart(2, '0');
                yearInput.value = dmyMatch[3];
                if (picker) picker.value = `${dmyMatch[3]}-${monthInput.value}-${dayInput.value}`;
                return;
            }

            // 3. Month + Year MM-YYYY
            const myMatch = s.match(/^(\d{1,2})[-\/.](\d{4})$/);
            if (myMatch) {
                dayInput.value = '';
                monthInput.value = myMatch[1].padStart(2, '0');
                yearInput.value = myMatch[2];
                if (picker) picker.value = '';
                return;
            }

            // 4. Year only YYYY
            const yMatch = s.match(/^(\d{4})$/);
            if (yMatch) {
                dayInput.value = '';
                monthInput.value = '';
                yearInput.value = yMatch[1];
                if (picker) picker.value = '';
                return;
            }

            // Fallback for 4-digit year
            const fallbackY = s.match(/(\d{4})/);
            if (fallbackY) {
                dayInput.value = '';
                monthInput.value = '';
                yearInput.value = fallbackY[1];
                if (picker) picker.value = '';
            }
        }

        // Setup keyboard navigation & auto-advance between day -> month -> year
        function setupSegmentedInput(prefix) {
            const day = document.getElementById(`${prefix}-day`);
            const month = document.getElementById(`${prefix}-month`);
            const year = document.getElementById(`${prefix}-year`);

            if (!day || !month || !year) return;

            // Day Segment (Max: 31, numbers only, auto-advance)
            day.addEventListener('input', function () {
                clearDateRangeError();
                let clean = this.value.replace(/\D/g, '');

                if (clean.length === 1) {
                    const firstDigit = parseInt(clean, 10);
                    // If user enters 4, 5, 6, 7, 8, 9, since no day starts with > 3,
                    // auto-format to 04, 05... and advance to month immediately
                    if (firstDigit > 3) {
                        this.value = '0' + clean;
                        month.focus();
                        month.select();
                        return;
                    }
                } else if (clean.length >= 2) {
                    clean = clean.slice(0, 2);
                    let num = parseInt(clean, 10);
                    // Strictly cap at 31 so user cannot type anything higher
                    if (num > 31) {
                        clean = '31';
                    }
                    this.value = clean;
                    month.focus();
                    month.select();
                    return;
                }
                this.value = clean;
            });
            day.addEventListener('blur', function () {
                if (this.value === '0' || this.value === '00') {
                    this.value = '01';
                } else if (this.value.length === 1 && this.value !== '') {
                    this.value = '0' + this.value;
                }
            });
            day.addEventListener('keydown', function (e) {
                if (e.key === 'ArrowRight' && (this.selectionStart === this.value.length || this.value.length === 2)) {
                    month.focus();
                    month.select();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    applyDateRange();
                }
            });

            // Month Segment (Max: 12, numbers only, auto-advance)
            month.addEventListener('input', function () {
                clearDateRangeError();
                let clean = this.value.replace(/\D/g, '');

                if (clean.length === 1) {
                    const firstDigit = parseInt(clean, 10);
                    // If user enters 2, 3, 4, 5, 6, 7, 8, 9, since no month starts with > 1,
                    // auto-format to 02, 03... and advance to year immediately
                    if (firstDigit > 1) {
                        this.value = '0' + clean;
                        year.focus();
                        year.select();
                        return;
                    }
                } else if (clean.length >= 2) {
                    clean = clean.slice(0, 2);
                    let num = parseInt(clean, 10);
                    // Strictly cap at 12 so user cannot type anything higher
                    if (num > 12) {
                        clean = '12';
                    }
                    this.value = clean;
                    year.focus();
                    year.select();
                    return;
                }
                this.value = clean;
            });
            month.addEventListener('blur', function () {
                if (this.value === '0' || this.value === '00') {
                    this.value = '01';
                } else if (this.value.length === 1 && this.value !== '') {
                    this.value = '0' + this.value;
                }
            });
            month.addEventListener('keydown', function (e) {
                if (e.key === 'Backspace' && this.value === '') {
                    day.focus();
                } else if (e.key === 'ArrowLeft' && this.selectionStart === 0) {
                    day.focus();
                } else if (e.key === 'ArrowRight' && (this.selectionStart === this.value.length || this.value.length === 2)) {
                    year.focus();
                    year.select();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    applyDateRange();
                }
            });

            // Year Segment
            year.addEventListener('input', function () {
                clearDateRangeError();
                this.value = this.value.replace(/\D/g, '').slice(0, 4);
            });
            year.addEventListener('keydown', function (e) {
                if (e.key === 'Backspace' && this.value === '') {
                    month.focus();
                } else if (e.key === 'ArrowLeft' && this.selectionStart === 0) {
                    month.focus();
                } else if (e.key === 'Enter') {
                    e.preventDefault();
                    applyDateRange();
                }
            });
        }

        setupSegmentedInput('from');
        setupSegmentedInput('to');

        // Calendar triggers & synchronization
        ['from', 'to'].forEach(prefix => {
            const btn = document.querySelector(`#seg-box-${prefix} .seg-cal-btn`);
            const picker = document.getElementById(`native-picker-${prefix}`);

            btn?.addEventListener('click', function (e) {
                e.preventDefault();
                if (picker) {
                    try {
                        if (typeof picker.showPicker === 'function') {
                            picker.showPicker();
                        } else {
                            picker.focus();
                            picker.click();
                        }
                    } catch (err) {
                        picker.click();
                    }
                }
            });

            picker?.addEventListener('change', function () {
                clearDateRangeError();
                if (this.value) {
                    populateSegments(prefix, this.value);
                }
            });
        });

        function updateDateFilterUI(appliedFilter, dateFromParam, dateToParam, totalResponses) {
            clearDateRangeError();
            populateSegments('from', dateFromParam);
            populateSegments('to', dateToParam);

            const hasActiveDate = Boolean(appliedFilter && (appliedFilter.from || appliedFilter.to));

            if (hasActiveDate) {
                if (dateFilterBanner) dateFilterBanner.style.display = 'flex';
                if (dateFilterDesc) {
                    const countText = totalResponses === 1 ? '1 response' : `${totalResponses} responses`;
                    dateFilterDesc.innerHTML = `Showing submissions from <strong>${appliedFilter.human_readable}</strong> (${countText} found)`;
                }
                if (resetDateBtn) resetDateBtn.style.display = 'inline-flex';
            } else {
                if (dateFilterBanner) dateFilterBanner.style.display = 'none';
                if (resetDateBtn) resetDateBtn.style.display = 'none';
            }
        }

        function applyDateRange() {
            const validation = validateDateRangeInputs();
            if (!validation.valid) {
                return;
            }

            const fromVal = validation.fromVal || '';
            const toVal = validation.toVal || '';

            const url = new URL(window.location);
            if (fromVal) {
                url.searchParams.set('date_from', fromVal);
            } else {
                url.searchParams.delete('date_from');
            }

            if (toVal) {
                url.searchParams.set('date_to', toVal);
            } else {
                url.searchParams.delete('date_to');
            }

            if (fromVal || toVal) {
                recordAnalyticsOperation(`Applied Date Filter [From: ${fromVal || 'Start'} To: ${toVal || 'Now'}]`);
            } else {
                recordAnalyticsOperation('Cleared Date Filter');
            }

            window.history.pushState({}, '', url);

            const urlParams = new URLSearchParams(window.location.search);
            const currentFormId = urlParams.get('form_id') || currentActiveFormId || 0;
            fetchAnalytics(currentFormId);
        }

        function clearDateRange() {
            clearDateRangeError();
            populateSegments('from', '');
            populateSegments('to', '');

            const url = new URL(window.location);
            url.searchParams.delete('date_from');
            url.searchParams.delete('date_to');
            window.history.pushState({}, '', url);

            recordAnalyticsOperation('Cleared Date Filter');

            const urlParams = new URLSearchParams(window.location.search);
            const currentFormId = urlParams.get('form_id') || currentActiveFormId || 0;
            fetchAnalytics(currentFormId);
        }

        applyDateBtn?.addEventListener('click', applyDateRange);
        resetDateBtn?.addEventListener('click', clearDateRange);
        dateFilterClearBannerBtn?.addEventListener('click', clearDateRange);

        // Export Excel handler
        document.getElementById('export-excel-btn')?.addEventListener('click', function () {
            const urlParams = new URLSearchParams(window.location.search);
            const currentFormId = urlParams.get('form_id') || 1;
            const year = urlParams.get('year') || '';
            const filters = urlParams.get('filters') || '{}';
            const statusStr = selectedStatusToView || 'all';
            const dateFrom = urlParams.get('date_from') || '';
            const dateTo = urlParams.get('date_to') || '';

            window.location.href = `../analytics/fetch_analytics.php?form_id=${currentFormId}&year=${encodeURIComponent(year)}&filters=${encodeURIComponent(filters)}&status=${encodeURIComponent(statusStr)}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}&export=excel`;
        });

        // ── PowerPoint Presentation Export Engine ────────────────────────
        async function fetchImageAsBase64(pathList) {
            for (const p of pathList) {
                try {
                    const res = await fetch(p);
                    if (res.ok) {
                        const blob = await res.blob();
                        return await new Promise((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(reader.result);
                            reader.readAsDataURL(blob);
                        });
                    }
                } catch (e) {
                    // Try next path
                }
            }
            return null;
        }

        // Helper to extract live rendered canvas image with solid background
        function getLiveCanvasDataUrl(canvas) {
            if (!canvas || !canvas.width || !canvas.height) return null;
            try {
                const offCanvas = document.createElement('canvas');
                offCanvas.width = canvas.width;
                offCanvas.height = canvas.height;
                const offCtx = offCanvas.getContext('2d');
                offCtx.fillStyle = '#ffffff';
                offCtx.fillRect(0, 0, offCanvas.width, offCanvas.height);
                offCtx.drawImage(canvas, 0, 0);
                return offCanvas.toDataURL('image/png', 1.0);
            } catch (e) {
                try {
                    return canvas.toDataURL('image/png', 1.0);
                } catch (e2) {
                    return null;
                }
            }
        }

        async function renderQuestionChartImage(q, overrideChartType = null) {
            return new Promise((resolve) => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1100;
                    canvas.height = 700;
                    const ctx = canvas.getContext('2d');

                    // Transparent background so slide background shows through cleanly
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    const labels = Object.keys(q.tallies || {});
                    const dataValues = Object.values(q.tallies || {});
                    const totalSum = dataValues.reduce((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0);
                    const totalAns = q.total_answered !== undefined ? q.total_answered : totalSum;

                    const colors = generateColorsForLabels(labels);
                    const qType = String(q.type || '').toLowerCase();
                    const isCheckbox = qType === 'checkbox';

                    // Use the exact active chart type matching the dashboard (Donut vs Pie vs Bar)
                    let chartType = overrideChartType || q._currentChartType;
                    if (!chartType || chartType === 'table') {
                        chartType = isCheckbox ? 'bar' : (labels.length > 5 ? 'bar' : 'donut');
                    }

                    let chartConfig;

                    if (chartType === 'donut') {
                        // ── High-Res Donut Chart with Center KPI (Matches Dashboard) ──
                        const donutCenterPlugin = {
                            id: 'pptDonutCenterKPI',
                            beforeDraw: (chart) => {
                                if (chart.config.type !== 'doughnut') return;
                                const { ctx, chartArea } = chart;
                                if (!chartArea) return;
                                const centerX = (chartArea.left + chartArea.right) / 2;
                                const centerY = (chartArea.top + chartArea.bottom) / 2;
                                ctx.save();
                                ctx.textAlign = 'center';
                                ctx.textBaseline = 'middle';

                                ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                                ctx.fillStyle = '#0f172a';
                                ctx.fillText(String(totalAns), centerX, centerY - 14);

                                ctx.font = 'bold 14px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                                ctx.fillStyle = '#64748b';
                                ctx.fillText('RESPONSES', centerX, centerY + 18);
                                ctx.restore();
                            }
                        };

                        chartConfig = {
                            type: 'doughnut',
                            data: {
                                labels: labels,
                                datasets: [{
                                    data: dataValues,
                                    backgroundColor: colors.backgroundColors,
                                    borderColor: '#ffffff',
                                    borderWidth: 2.5
                                }]
                            },
                            options: {
                                responsive: false,
                                animation: false,
                                devicePixelRatio: 1,
                                cutout: '66%',
                                layout: { padding: 15 },
                                plugins: {
                                    legend: {
                                        position: 'right',
                                        labels: {
                                            usePointStyle: true,
                                            pointStyle: 'circle',
                                            boxWidth: 10,
                                            boxHeight: 10,
                                            padding: 14,
                                            font: { size: labels.length > 5 ? 13 : 15, weight: '500' },
                                            generateLabels: function (chart) {
                                                const chartData = chart.data;
                                                const ds = chartData.datasets[0];
                                                const sum = ds.data.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
                                                return chartData.labels.map((label, i) => {
                                                    const val = ds.data[i] || 0;
                                                    const pct = sum > 0 ? ((val / sum) * 100).toFixed(1) : '0.0';
                                                    return {
                                                        text: `${label} (${pct}%)`,
                                                        fillStyle: ds.backgroundColor[i],
                                                        strokeStyle: '#ffffff',
                                                        lineWidth: 1,
                                                        pointStyle: 'circle',
                                                        index: i
                                                    };
                                                });
                                            }
                                        }
                                    }
                                }
                            },
                            plugins: [donutCenterPlugin]
                        };
                    } else if (chartType === 'pie') {
                        // ── High-Res Pie Chart (Matches Dashboard) ──
                        chartConfig = {
                            type: 'pie',
                            data: {
                                labels: labels,
                                datasets: [{
                                    data: dataValues,
                                    backgroundColor: colors.backgroundColors,
                                    borderColor: '#ffffff',
                                    borderWidth: 2.5
                                }]
                            },
                            options: {
                                responsive: false,
                                animation: false,
                                devicePixelRatio: 1,
                                layout: { padding: 15 },
                                plugins: {
                                    legend: {
                                        position: 'right',
                                        labels: {
                                            usePointStyle: true,
                                            pointStyle: 'circle',
                                            boxWidth: 10,
                                            boxHeight: 10,
                                            padding: 14,
                                            font: { size: labels.length > 5 ? 13 : 15, weight: '500' },
                                            generateLabels: function (chart) {
                                                const chartData = chart.data;
                                                const ds = chartData.datasets[0];
                                                const sum = ds.data.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);
                                                return chartData.labels.map((label, i) => {
                                                    const val = ds.data[i] || 0;
                                                    const pct = sum > 0 ? ((val / sum) * 100).toFixed(1) : '0.0';
                                                    return {
                                                        text: `${label} (${pct}%)`,
                                                        fillStyle: ds.backgroundColor[i],
                                                        strokeStyle: '#ffffff',
                                                        lineWidth: 1,
                                                        pointStyle: 'circle',
                                                        index: i
                                                    };
                                                });
                                            }
                                        }
                                    }
                                }
                            },
                            plugins: []
                        };
                    } else {
                        // ── High-Res Horizontal / Ranked Bar Chart (Matches Dashboard) ──
                        const sorted = labels.map((l, i) => ({ label: l, value: dataValues[i] }))
                            .sort((a, b) => b.value - a.value);
                        const sortedLabels = sorted.map(s => s.label);
                        const sortedValues = sorted.map(s => s.value);
                        const sortedColors = generateColorsForLabels(sortedLabels);

                        chartConfig = {
                            type: 'bar',
                            data: {
                                labels: sortedLabels,
                                datasets: [{
                                    data: sortedValues,
                                    backgroundColor: sortedColors.backgroundColors,
                                    borderColor: sortedColors.borderColors,
                                    borderWidth: 1.5,
                                    borderRadius: 6,
                                    barPercentage: 0.68
                                }]
                            },
                            options: {
                                indexAxis: 'y',
                                responsive: false,
                                animation: false,
                                devicePixelRatio: 1,
                                layout: { padding: { right: 85, left: 10, top: 15, bottom: 15 } },
                                plugins: {
                                    legend: { display: false }
                                },
                                scales: {
                                    x: {
                                        beginAtZero: true,
                                        ticks: {
                                            font: { size: 12 },
                                            precision: 0,
                                            maxTicksLimit: 6,
                                            stepSize: Math.max(1, Math.ceil(Math.max(...sortedValues, 1) / 5))
                                        },
                                        grid: { color: 'rgba(226, 232, 240, 0.8)' }
                                    },
                                    y: {
                                        ticks: {
                                            font: { size: sortedLabels.length > 8 ? 11 : 13, weight: '500' },
                                            color: '#1e293b'
                                        },
                                        grid: { display: false }
                                    }
                                }
                            },
                            plugins: []
                        };
                    }

                    // Plugin to render percentage labels directly on chart slices and bars (matching dashboard)
                    const pptPercentagePlugin = {
                        id: 'pptPercentagePlugin',
                        afterDatasetsDraw: (chart) => {
                            const chartCtx = chart.ctx;
                            chartCtx.save();
                            chartCtx.shadowColor = 'rgba(255, 255, 255, 0.95)';
                            chartCtx.shadowBlur = 4;
                            chartCtx.shadowOffsetX = 0;
                            chartCtx.shadowOffsetY = 0;

                            const ds = chart.data.datasets[0];
                            const meta = chart.getDatasetMeta(0);
                            const total = ds.data.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0);

                            if (chart.config.type === 'pie' || chart.config.type === 'doughnut') {
                                chartCtx.font = 'bold ' + (labels.length > 7 ? '14px' : '16px') + ' -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                                chartCtx.textAlign = 'center';
                                chartCtx.textBaseline = 'middle';
                                chartCtx.fillStyle = '#0f172a';

                                meta.data.forEach((element, idx) => {
                                    const val = ds.data[idx];
                                    if (val && val > 0) {
                                        const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0.0%';
                                        if (parseFloat(pct) >= 4.0) {
                                            let posX, posY;
                                            if (typeof element.tooltipPosition === 'function') {
                                                const pos = element.tooltipPosition();
                                                posX = pos.x;
                                                posY = pos.y;
                                            } else {
                                                const midAngle = element.startAngle + (element.endAngle - element.startAngle) / 2;
                                                const mult = chart.config.type === 'doughnut' ? 0.82 : 0.60;
                                                const r = (element.outerRadius + (element.innerRadius || 0)) * mult;
                                                posX = element.x + Math.cos(midAngle) * r;
                                                posY = element.y + Math.sin(midAngle) * r;
                                            }
                                            chartCtx.fillText(pct, posX, posY);
                                        }
                                    }
                                });
                            } else if (chart.config.type === 'bar') {
                                chartCtx.font = 'bold 13px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                                chartCtx.textAlign = 'left';
                                chartCtx.textBaseline = 'middle';
                                chartCtx.fillStyle = '#0f172a';

                                meta.data.forEach((element, idx) => {
                                    const val = ds.data[idx];
                                    if (val !== undefined && val !== null) {
                                        const pct = total > 0 ? ((val / total) * 100).toFixed(1) + '%' : '0.0%';
                                        const text = `${val} (${pct})`;
                                        chartCtx.fillText(text, element.x + 8, element.y);
                                    }
                                });
                            }
                            chartCtx.restore();
                        }
                    };

                    chartConfig.plugins.push(pptPercentagePlugin);
                    const chartInstance = new Chart(ctx, chartConfig);
                    setTimeout(() => {
                        const imgData = canvas.toDataURL('image/png', 1.0);
                        chartInstance.destroy();
                        resolve(imgData);
                    }, 50);
                } catch (err) {
                    console.error('Error generating chart image for PPT:', err);
                    resolve(null);
                }
            });
        }

        async function renderTimelineChartImage(timelineData, isCumulative = false, customGranularity = null) {
            return new Promise((resolve) => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1100;
                    canvas.height = 650;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    const granularity = customGranularity || (timelineData.daily && timelineData.daily.length > 35 ? 'monthly' : 'daily');
                    const series = granularity === 'monthly' ? (timelineData.monthly || []) : (timelineData.daily || []);
                    const labels = series.map(s => s.short_label || s.label);
                    const dataValues = series.map(s => isCumulative ? s.cumulative : s.count);

                    const chartConfig = {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: [{
                                label: isCumulative ? 'Cumulative Responses' : (granularity === 'monthly' ? 'Monthly Submissions' : 'Daily Submissions'),
                                data: dataValues,
                                borderColor: '#b32b2b',
                                backgroundColor: '#b32b2b',
                                borderWidth: 3.5,
                                fill: false,
                                tension: 0.35,
                                pointBackgroundColor: '#b32b2b',
                                pointBorderColor: '#ffffff',
                                pointBorderWidth: 2.5,
                                pointRadius: labels.length > 25 ? 4 : 6
                            }]
                        },
                        options: {
                            responsive: false,
                            animation: false,
                            devicePixelRatio: 1,
                            layout: { padding: { top: 25, right: 30, bottom: 15, left: 15 } },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top',
                                    labels: {
                                        font: { size: 14, weight: 'bold' },
                                        color: '#1e293b',
                                        boxWidth: 16
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    grid: { display: false },
                                    ticks: {
                                        font: { size: 12, weight: '500' },
                                        color: '#475569',
                                        maxRotation: labels.length > 12 ? 45 : 0,
                                        autoSkip: true,
                                        maxTicksLimit: 5
                                    }
                                },
                                y: {
                                    beginAtZero: true,
                                    grid: { color: 'rgba(226, 232, 240, 0.8)' },
                                    ticks: {
                                        precision: 0,
                                        font: { size: 12 },
                                        color: '#64748b',
                                        maxTicksLimit: 6,
                                        stepSize: Math.max(1, Math.ceil(Math.max(...dataValues, 1) / 5))
                                    }
                                }
                            }
                        }
                    };

                    const dataLabelsPlugin = {
                        id: 'timelineDataLabelsPlugin',
                        afterDatasetsDraw: (chart) => {
                            const chartCtx = chart.ctx;
                            chartCtx.save();
                            chartCtx.font = 'bold 12px "Roboto", -apple-system, sans-serif';
                            chartCtx.textAlign = 'center';
                            chartCtx.textBaseline = 'bottom';
                            chartCtx.fillStyle = '#991b1b';

                            const meta = chart.getDatasetMeta(0);
                            meta.data.forEach((element, idx) => {
                                const val = dataValues[idx];
                                if (val !== undefined && val !== null && (labels.length <= 20 || val > 0)) {
                                    chartCtx.fillText(String(val), element.x, element.y - 7);
                                }
                            });
                            chartCtx.restore();
                        }
                    };

                    chartConfig.plugins = [dataLabelsPlugin];
                    const chartInstance = new Chart(ctx, chartConfig);
                    setTimeout(() => {
                        const imgData = canvas.toDataURL('image/png', 1.0);
                        chartInstance.destroy();
                        resolve(imgData);
                    }, 50);
                } catch (err) {
                    console.error('Error rendering timeline chart for PPT:', err);
                    resolve(null);
                }
            });
        }

        async function renderYoYChartImage(yoyData, viewMode = 'overall') {
            return new Promise((resolve) => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1100;
                    canvas.height = 650;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    const labels = (yoyData.overall_series || []).map(s => s.label);
                    const years = yoyData.years || [];

                    let datasets = [];
                    if (viewMode === 'overall') {
                        const overallScores = (yoyData.overall_series || []).map(s => s.score_5);
                        datasets = [
                            {
                                label: 'Overall Rating Score (/5.0)',
                                data: overallScores,
                                borderColor: '#b32b2b',
                                backgroundColor: '#b32b2b',
                                borderWidth: 4,
                                fill: false,
                                tension: 0.35,
                                pointBackgroundColor: '#b32b2b',
                                pointBorderColor: '#ffffff',
                                pointBorderWidth: 3,
                                pointRadius: 8
                            },
                            {
                                label: 'IQAC Benchmark Target (4.0 / 5.0)',
                                data: labels.map(() => yoyData.target_benchmark || 4.0),
                                borderColor: '#10b981',
                                backgroundColor: '#10b981',
                                borderWidth: 2.5,
                                borderDash: [8, 6],
                                fill: false,
                                pointRadius: 0,
                                tension: 0
                            }
                        ];
                    } else {
                        const palette = [
                            '#b32b2b', '#0284c7', '#10b981', '#8b5cf6',
                            '#f59e0b', '#ec4899', '#0d9488', '#6366f1',
                            '#e11d48', '#84cc16'
                        ];
                        datasets = (yoyData.category_series || []).map((cat, idx) => {
                            const color = palette[idx % palette.length];
                            const dataVals = years.map(yr => {
                                return (cat.scores && cat.scores[yr] !== undefined && cat.scores[yr] !== null)
                                    ? cat.scores[yr]
                                    : null;
                            });
                            return {
                                label: cat.name,
                                data: dataVals,
                                borderColor: color,
                                backgroundColor: color,
                                borderWidth: 3,
                                fill: false,
                                tension: 0.3,
                                pointBackgroundColor: color,
                                pointBorderColor: '#ffffff',
                                pointBorderWidth: 2,
                                pointRadius: 6,
                                spanGaps: true
                            };
                        });
                    }

                    const chartConfig = {
                        type: 'line',
                        data: {
                            labels: labels,
                            datasets: datasets
                        },
                        options: {
                            responsive: false,
                            animation: false,
                            devicePixelRatio: 1,
                            layout: { padding: { top: 30, right: 30, bottom: 15, left: 15 } },
                            plugins: {
                                legend: {
                                    display: true,
                                    position: 'top',
                                    labels: {
                                        font: { size: 14, weight: 'bold' },
                                        color: '#1e293b',
                                        boxWidth: 18,
                                        padding: 18
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    grid: { display: false },
                                    ticks: {
                                        font: { size: 14, weight: 'bold' },
                                        color: '#1e293b'
                                    }
                                },
                                y: {
                                    min: 0,
                                    max: 5,
                                    grid: { color: 'rgba(226, 232, 240, 0.8)' },
                                    ticks: {
                                        stepSize: 1,
                                        font: { size: 12 },
                                        color: '#64748b',
                                        callback: (v) => `${v}.0 / 5.0`
                                    }
                                }
                            }
                        }
                    };

                    if (viewMode === 'overall') {
                        const yoyLabelsPlugin = {
                            id: 'yoyLabelsPlugin',
                            afterDatasetsDraw: (chart) => {
                                const chartCtx = chart.ctx;
                                chartCtx.save();
                                chartCtx.font = 'bold 15px "Roboto", -apple-system, sans-serif';
                                chartCtx.textAlign = 'center';
                                chartCtx.textBaseline = 'bottom';
                                chartCtx.fillStyle = '#7f1d1d';

                                const meta = chart.getDatasetMeta(0);
                                meta.data.forEach((element, idx) => {
                                    const val = (yoyData.overall_series || [])[idx]?.score_5;
                                    if (val !== undefined && val !== null) {
                                        const pct = yoyData.overall_series[idx]?.percentage || 0;
                                        chartCtx.fillText(`${val.toFixed(2)} (${pct}%)`, element.x, element.y - 12);
                                    }
                                });
                                chartCtx.restore();
                            }
                        };
                        chartConfig.plugins = [yoyLabelsPlugin];
                    }

                    const chartInstance = new Chart(ctx, chartConfig);
                    setTimeout(() => {
                        const imgData = canvas.toDataURL('image/png', 1.0);
                        chartInstance.destroy();
                        resolve(imgData);
                    }, 50);
                } catch (err) {
                    console.error('Error rendering YoY chart for PPT:', err);
                    resolve(null);
                }
            });
        }

        async function renderGroupMatrixChartImage(group, questionsToRender, allOptions, activeType = 'stacked') {
            return new Promise((resolve) => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = 1100;
                    const dynamicH = Math.max(650, questionsToRender.length * 85 + 130);
                    canvas.height = dynamicH;
                    const ctx = canvas.getContext('2d');
                    ctx.clearRect(0, 0, canvas.width, canvas.height);

                    const questionLabels = questionsToRender.map(q => {
                        const text = q.question || '';
                        return text.length > 55 ? text.substring(0, 52) + '...' : text;
                    });

                    if (activeType === 'radar') {
                        const scores = questionsToRender.map(q => {
                            return q.weighted_score ? parseFloat(q.weighted_score).toFixed(2) : 0;
                        });
                        const chartConfig = {
                            type: 'radar',
                            data: {
                                labels: questionLabels,
                                datasets: [{
                                    label: 'Average Rating Score (out of 5.0)',
                                    data: scores,
                                    backgroundColor: 'rgba(26, 115, 232, 0.25)',
                                    borderColor: '#1a73e8',
                                    borderWidth: 3.5,
                                    pointBackgroundColor: '#1a73e8',
                                    pointBorderColor: '#ffffff',
                                    pointBorderWidth: 2.5,
                                    pointRadius: 6
                                }]
                            },
                            options: {
                                responsive: false,
                                animation: false,
                                devicePixelRatio: 1,
                                plugins: {
                                    legend: {
                                        position: 'top',
                                        labels: { font: { size: 14, weight: 'bold' } }
                                    }
                                },
                                scales: {
                                    r: {
                                        min: 0,
                                        max: 5,
                                        ticks: { stepSize: 1, font: { size: 12, weight: '600' } },
                                        pointLabels: { font: { size: 13, weight: 'bold' }, color: '#1e293b' },
                                        grid: { color: 'rgba(0, 0, 0, 0.08)' }
                                    }
                                }
                            }
                        };
                        const chartInstance = new Chart(ctx, chartConfig);
                        setTimeout(() => {
                            const imgData = canvas.toDataURL('image/png', 1.0);
                            chartInstance.destroy();
                            resolve(imgData);
                        }, 50);
                        return;
                    }

                    if (activeType === 'diverging') {
                        const likertInfo = categorizeLikertOptions(allOptions);
                        const { negOptions, neuOptions, posOptions } = likertInfo;
                        const datasets = [];

                        negOptions.forEach(item => {
                            const opt = item.option;
                            const color = getSemanticColor(opt) || { bg: '#fca5a5', border: '#dc2626' };
                            datasets.push({
                                label: opt,
                                data: questionsToRender.map(q => {
                                    const cnt = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                                    const total = q.total_answered || 1;
                                    return -parseFloat(((cnt / total) * 100).toFixed(2));
                                }),
                                backgroundColor: color.bg,
                                borderColor: color.border,
                                borderWidth: 1.5,
                                borderRadius: 3,
                                barPercentage: 0.72
                            });
                        });

                        if (neuOptions.length > 0) {
                            const neuOpt = neuOptions[0].option;
                            const neuColor = getSemanticColor(neuOpt) || { bg: '#fde047', border: '#ca8a04' };
                            datasets.push({
                                label: neuOpt,
                                data: questionsToRender.map(q => {
                                    const cnt = (q.tallies && q.tallies[neuOpt]) ? q.tallies[neuOpt] : 0;
                                    const total = q.total_answered || 1;
                                    return parseFloat(((cnt / total) * 50).toFixed(2));
                                }),
                                backgroundColor: neuColor.bg,
                                borderColor: neuColor.border,
                                borderWidth: 1.5,
                                borderRadius: 3,
                                barPercentage: 0.72
                            });
                        }

                        posOptions.forEach(item => {
                            const opt = item.option;
                            const color = getSemanticColor(opt) || { bg: '#86efac', border: '#16a34a' };
                            datasets.push({
                                label: opt,
                                data: questionsToRender.map(q => {
                                    const cnt = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                                    const total = q.total_answered || 1;
                                    return parseFloat(((cnt / total) * 100).toFixed(2));
                                }),
                                backgroundColor: color.bg,
                                borderColor: color.border,
                                borderWidth: 1.5,
                                borderRadius: 3,
                                barPercentage: 0.72
                            });
                        });

                        const chartConfig = {
                            type: 'bar',
                            data: {
                                labels: questionLabels,
                                datasets: datasets
                            },
                            options: {
                                indexAxis: 'y',
                                responsive: false,
                                animation: false,
                                devicePixelRatio: 1,
                                layout: { padding: { right: 25, left: 10, top: 15, bottom: 15 } },
                                plugins: {
                                    legend: {
                                        position: 'top',
                                        labels: { font: { size: 13, weight: 'bold' }, color: '#1e293b', boxWidth: 16, padding: 14 }
                                    }
                                },
                                scales: {
                                    x: {
                                        stacked: true,
                                        grid: {
                                            color: (c) => (c.tick && c.tick.value === 0) ? '#0f172a' : 'rgba(226, 232, 240, 0.8)',
                                            lineWidth: (c) => (c.tick && c.tick.value === 0) ? 2 : 1
                                        },
                                        ticks: {
                                            stepSize: 20,
                                            callback: (v) => Math.abs(v) + '%',
                                            font: { size: 12 },
                                            color: '#64748b'
                                        }
                                    },
                                    y: {
                                        stacked: true,
                                        grid: { display: false },
                                        ticks: {
                                            font: { size: questionsToRender.length > 8 ? 11 : 13, weight: '500' },
                                            color: '#1e293b'
                                        }
                                    }
                                }
                            }
                        };
                        const chartInstance = new Chart(ctx, chartConfig);
                        setTimeout(() => {
                            const imgData = canvas.toDataURL('image/png', 1.0);
                            chartInstance.destroy();
                            resolve(imgData);
                        }, 50);
                        return;
                    }

                    // Default: 100% Stacked Bar
                    const colors = generateColorsForLabels(allOptions);
                    const datasets = allOptions.map((opt, i) => {
                        const dataPoints = questionsToRender.map(q => {
                            const cnt = (q.tallies && q.tallies[opt]) ? q.tallies[opt] : 0;
                            const total = q.total_answered || 1;
                            return parseFloat(((cnt / total) * 100).toFixed(2));
                        });
                        const sem = getSemanticColor(opt);
                        const bg = sem ? sem.bg : colors.backgroundColors[i % colors.backgroundColors.length];
                        const border = sem ? sem.border : colors.borderColors[i % colors.borderColors.length];
                        return {
                            label: opt,
                            data: dataPoints,
                            backgroundColor: bg,
                            borderColor: border,
                            borderWidth: 1.5,
                            borderRadius: 3,
                            barPercentage: 0.72
                        };
                    });

                    const chartConfig = {
                        type: 'bar',
                        data: {
                            labels: questionLabels,
                            datasets: datasets
                        },
                        options: {
                            indexAxis: 'y',
                            responsive: false,
                            animation: false,
                            devicePixelRatio: 1,
                            layout: { padding: { right: 25, left: 10, top: 15, bottom: 15 } },
                            plugins: {
                                legend: {
                                    position: 'top',
                                    labels: {
                                        font: { size: 13, weight: 'bold' },
                                        color: '#1e293b',
                                        boxWidth: 16,
                                        padding: 14
                                    }
                                }
                            },
                            scales: {
                                x: {
                                    stacked: true,
                                    min: 0,
                                    max: 100,
                                    grid: { color: 'rgba(226, 232, 240, 0.8)' },
                                    ticks: {
                                        stepSize: 20,
                                        callback: (v) => v + '%',
                                        font: { size: 12 },
                                        color: '#64748b'
                                    }
                                },
                                y: {
                                    stacked: true,
                                    grid: { display: false },
                                    ticks: {
                                        font: { size: questionsToRender.length > 8 ? 11 : 13, weight: '500' },
                                        color: '#1e293b'
                                    }
                                }
                            }
                        }
                    };

                    const stackedBarLabelsPlugin = {
                        id: 'stackedBarLabelsPlugin',
                        afterDatasetsDraw: (chart) => {
                            const chartCtx = chart.ctx;
                            chartCtx.save();
                            chartCtx.font = 'bold 11px "Roboto", -apple-system, sans-serif';
                            chartCtx.textAlign = 'center';
                            chartCtx.textBaseline = 'middle';
                            chartCtx.fillStyle = '#0f172a';

                            chart.data.datasets.forEach((ds, dsIdx) => {
                                const meta = chart.getDatasetMeta(dsIdx);
                                meta.data.forEach((bar, rowIdx) => {
                                    const pct = ds.data[rowIdx];
                                    if (pct && pct >= 7.0) {
                                        const barW = Math.abs(bar.width || (bar.x - bar.base));
                                        if (barW >= 35) {
                                            const centerX = (bar.base + bar.x) / 2;
                                            chartCtx.fillText(`${Math.round(pct)}%`, centerX, bar.y);
                                        }
                                    }
                                });
                            });
                            chartCtx.restore();
                        }
                    };

                    chartConfig.plugins = [stackedBarLabelsPlugin];
                    const chartInstance = new Chart(ctx, chartConfig);
                    setTimeout(() => {
                        const imgData = canvas.toDataURL('image/png', 1.0);
                        chartInstance.destroy();
                        resolve(imgData);
                    }, 50);
                } catch (err) {
                    console.error('Error rendering group matrix chart for PPT:', err);
                    resolve(null);
                }
            });
        }
        const renderGroupStackedChartImage = renderGroupMatrixChartImage;

        async function exportAnalyticsPPT() {
            if (typeof PptxGenJS === 'undefined') {
                if (typeof Swal !== 'undefined') {
                    Swal.fire('Error', 'PowerPoint export library is still loading or not available.', 'error');
                } else {
                    alert('PowerPoint export library is not available.');
                }
                return;
            }

            if (!currentData || !currentData.summary || currentData.summary.total_responses === 0) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire('No Responses', 'There is no response data available to generate a PowerPoint report.', 'info');
                } else {
                    alert('There is no response data available to generate a PowerPoint report.');
                }
                return;
            }

            // 1. Identify Line Charts to Export
            const hasTimeline = Boolean(currentData.submission_timeline && currentData.submission_timeline.has_timeline && selectedQuestionToView === 'all');
            const hasYoY = Boolean(currentData.yoy_trend && currentData.yoy_trend.has_multi_year && selectedQuestionToView === 'all');

            // 2. Collect Comparative Groups & Grouped Rating Matrices (100% Stacked Bar Charts)
            const comparativeGroupsToExport = [];
            const exportedGroupNames = new Set();

            if (selectedQuestionToView === 'all' && currentData.comparative_groups && Array.isArray(currentData.comparative_groups)) {
                currentData.comparative_groups.forEach(cg => {
                    let validQs = (cg.questions || []).filter(q => {
                        if (selectedStatusToView === 'active' && q.active !== 1) return false;
                        if (selectedStatusToView === 'archived' && q.active !== 0) return false;
                        return hasQuestionResponses(q);
                    });
                    if (validQs.length > 1) {
                        let opts = cg.options && cg.options.length > 0 ? cg.options : [];
                        if (opts.length === 0) {
                            const optSet = new Set();
                            validQs.forEach(q => Object.keys(q.tallies || {}).forEach(k => optSet.add(k)));
                            opts = Array.from(optSet);
                        }
                        comparativeGroupsToExport.push({
                            group_name: cg.group_name || 'Comparative Group Analysis',
                            questions: validQs,
                            options: opts
                        });
                        exportedGroupNames.add(cg.group_name);
                    }
                });
            }

            if (selectedQuestionToView === 'all' && currentData.groups && Array.isArray(currentData.groups)) {
                currentData.groups.forEach(grp => {
                    if (grp.group_id && grp.group_id.startsWith('ungrouped_')) return;
                    if (exportedGroupNames.has(grp.group_name)) return;

                    let validQs = (grp.questions || []).filter(q => {
                        if (selectedStatusToView === 'active' && q.active !== 1) return false;
                        if (selectedStatusToView === 'archived' && q.active !== 0) return false;
                        return hasQuestionResponses(q);
                    });
                    if (validQs.length > 1) {
                        let opts = grp.options && grp.options.length > 0 ? grp.options : [];
                        if (opts.length === 0) {
                            const optSet = new Set();
                            validQs.forEach(q => Object.keys(q.tallies || {}).forEach(k => optSet.add(k)));
                            opts = Array.from(optSet);
                        }
                        comparativeGroupsToExport.push({
                            group_name: grp.group_name || 'Group Rating Matrix',
                            questions: validQs,
                            options: opts
                        });
                        exportedGroupNames.add(grp.group_name);
                    }
                });
            }

            // 3. Collect Individual Question Slides
            const questionsToExport = [];
            if (currentData.groups && Array.isArray(currentData.groups)) {
                currentData.groups.forEach(group => {
                    if (!group.questions || !Array.isArray(group.questions)) return;
                    group.questions.forEach(q => {
                        if (selectedStatusToView === 'active' && q.active !== 1) return;
                        if (selectedStatusToView === 'archived' && q.active !== 0) return;
                        if (selectedQuestionToView !== 'all' && q.question !== selectedQuestionToView) return;

                        const qType = String(q.type || '').toLowerCase().trim();
                        if (['text', 'textarea', 'comment'].includes(qType)) return;
                        if (!hasQuestionResponses(q)) return;

                        questionsToExport.push({
                            groupName: group.group_name || 'General Evaluation',
                            q: q
                        });
                    });
                });
            }

            if (!hasTimeline && !hasYoY && comparativeGroupsToExport.length === 0 && questionsToExport.length === 0) {
                if (typeof Swal !== 'undefined') {
                    Swal.fire('No Charts to Export', 'No charts or quantifiable feedback responses were found to export.', 'warning');
                } else {
                    alert('No charts or quantifiable feedback responses were found to export.');
                }
                return;
            }

            // 4. Determine presentation metadata & total slides count
            const currentForm = currentData.forms ? currentData.forms.find(f => f.id == currentData.current_form_id) : null;
            const formTitle = currentForm ? currentForm.title : 'Stakeholder Feedback Report';
            const urlParams = new URLSearchParams(window.location.search);
            const yearParam = urlParams.get('year') || 'All Academic Years';
            const dateStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

            const totalSlides = 1 + (hasTimeline ? 1 : 0) + (hasYoY ? 1 : 0) + comparativeGroupsToExport.length + questionsToExport.length;

            // 5. Inject styles for clean modal
            if (!document.getElementById('ppt-export-styles')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'ppt-export-styles';
                styleEl.textContent = `
                    .ppt-clean-modal {
                        border-radius: 12px !important;
                        padding: 24px 22px 20px 22px !important;
                        box-shadow: 0 12px 32px -4px rgba(0, 0, 0, 0.12), 0 4px 6px -2px rgba(0, 0, 0, 0.05) !important;
                        border: 1px solid #e2e8f0 !important;
                        background: #ffffff !important;
                        font-family: 'Roboto', -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif !important;
                    }
                    .ppt-clean-modal .swal2-title {
                        font-size: 18px !important;
                        font-weight: 600 !important;
                        color: #0f172a !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        font-family: inherit !important;
                    }
                    .ppt-clean-modal .swal2-html-container {
                        margin: 0 !important;
                        padding: 0 !important;
                        overflow: visible !important;
                    }
                `;
                document.head.appendChild(styleEl);
            }

            // 6. Show clean progress modal
            if (typeof Swal !== 'undefined') {
                Swal.fire({
                    title: 'Generating PowerPoint Report',
                    html: `
                        <div style="font-family: 'Roboto', sans-serif; padding: 6px 4px 2px 4px; text-align: center;">
                            <div style="width: 48px; height: 48px; margin: 12px auto 14px auto; border-radius: 50%; background: #fdf2f2; border: 1px solid #fecaca; display: flex; align-items: center; justify-content: center; color: #b32b2b;">
                                <svg width="24" height="24" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z"></path>
                                </svg>
                            </div>
                            <div id="ppt-progress-status" style="font-size: 13.5px; color: #475569; margin-bottom: 14px; min-height: 20px;">
                                Initializing presentation...
                            </div>
                            <div style="background: #e2e8f0; border-radius: 999px; height: 7px; width: 100%; overflow: hidden; margin-bottom: 8px;">
                                <div id="ppt-progress-bar" style="background: #b32b2b; height: 100%; width: 5%; border-radius: 999px; transition: width 0.25s ease;"></div>
                            </div>
                            <div style="display: flex; justify-content: space-between; font-size: 12px; color: #64748b; font-weight: 500;">
                                <span id="ppt-slide-counter">Preparing slides...</span>
                                <span id="ppt-progress-pct" style="color: #b32b2b; font-weight: 600;">5%</span>
                            </div>
                        </div>
                    `,
                    allowOutsideClick: false,
                    showConfirmButton: false,
                    customClass: { popup: 'ppt-clean-modal' },
                    width: 390
                });
            }

            function updateProgress(curr, total, statusText) {
                const pct = Math.min(100, Math.max(5, Math.round((curr / total) * 100)));
                const bar = document.getElementById('ppt-progress-bar');
                const stat = document.getElementById('ppt-progress-status');
                const pctEl = document.getElementById('ppt-progress-pct');
                const counterEl = document.getElementById('ppt-slide-counter');

                if (bar) bar.style.width = pct + '%';
                if (pctEl) pctEl.textContent = pct + '%';
                if (stat && statusText) stat.textContent = statusText;
                if (counterEl) {
                    if (curr === 0) {
                        counterEl.textContent = 'Preparing presentation...';
                    } else if (curr >= total) {
                        counterEl.textContent = 'Finalizing presentation file...';
                    } else {
                        counterEl.textContent = `Slide ${curr} of ${total}`;
                    }
                }
            }

            try {
                const logoBase64 = await fetchImageAsBase64(['../images/iqac_logo_transparent.png', 'images/iqac_logo_transparent.png', '../images/iqac_logo.png', 'images/iqac_logo.png']);

                const pptx = new PptxGenJS();
                pptx.layout = 'LAYOUT_16x9'; // 10" x 5.625"
                pptx.author = 'Internal Quality Assurance Cell (IQAC)';
                pptx.company = 'Institutional Stakeholder Feedback System';
                pptx.title = `${formTitle} - Analytics Report`;

                let currentSlideNum = 1;

                function addSlideFooter(slide, slideIndex) {
                    slide.addShape(pptx.shapes.LINE, {
                        x: 0.6,
                        y: 5.15,
                        w: 8.8,
                        h: 0,
                        line: { color: 'E2E8F0', width: 0.75 }
                    });
                    slide.addText(formTitle, {
                        x: 0.6,
                        y: 5.22,
                        w: 4.5,
                        h: 0.3,
                        fontSize: 8.5,
                        color: '64748B',
                        align: 'left'
                    });
                    slide.addText('Internal Quality Assurance Cell (IQAC)', {
                        x: 3.5,
                        y: 5.22,
                        w: 3.0,
                        h: 0.3,
                        fontSize: 8.5,
                        color: '94A3B8',
                        align: 'center'
                    });
                    slide.addText(`Slide ${slideIndex} of ${totalSlides}`, {
                        x: 7.2,
                        y: 5.22,
                        w: 2.2,
                        h: 0.3,
                        fontSize: 8.5,
                        color: '64748B',
                        align: 'right',
                        bold: true
                    });
                }

                // ── SLIDE 1: Cover Page ──────────────────────────────────────
                const slide1 = pptx.addSlide();
                slide1.background = { color: 'FFFFFF' };

                if (logoBase64) {
                    slide1.addImage({
                        data: logoBase64,
                        x: 7.7,
                        y: 0.50,
                        w: 1.5,
                        h: 1.48
                    });
                }

                slide1.addText('INTERNAL QUALITY ASSURANCE CELL (IQAC)', {
                    x: 0.8,
                    y: 0.75,
                    w: 6.8,
                    h: 0.3,
                    fontSize: 10.5,
                    color: '4F46E5',
                    bold: true,
                    charSpacing: 2
                });

                slide1.addText(formTitle, {
                    x: 0.8,
                    y: 1.15,
                    w: 6.8,
                    h: 1.1,
                    fontSize: 24,
                    color: '0F172A',
                    bold: true,
                    wrap: true,
                    valign: 'top'
                });

                slide1.addText('Stakeholder Feedback Evaluation & Visual Analytics Report', {
                    x: 0.8,
                    y: 2.30,
                    w: 8.4,
                    h: 0.35,
                    fontSize: 13,
                    color: '64748B'
                });

                slide1.addShape(pptx.shapes.RECTANGLE, {
                    x: 0.8,
                    y: 2.75,
                    w: 8.4,
                    h: 2.05,
                    fill: { color: 'F8FAFC' },
                    line: { color: 'E2E8F0', width: 1 }
                });

                slide1.addShape(pptx.shapes.LINE, {
                    x: 1.1,
                    y: 3.75,
                    w: 7.8,
                    h: 0,
                    line: { color: 'E2E8F0', width: 0.75 }
                });
                slide1.addShape(pptx.shapes.LINE, {
                    x: 5.0,
                    y: 2.90,
                    w: 0,
                    h: 1.70,
                    line: { color: 'E2E8F0', width: 0.75 }
                });

                const summary = currentData.summary || {};

                slide1.addText([
                    { text: "TOTAL SUBMISSIONS\n", options: { bold: true, fontSize: 8.5, color: '64748B', charSpacing: 1 } },
                    { text: `${summary.total_responses || 0}`, options: { bold: true, fontSize: 16, color: '0F172A' } },
                    { text: " Verified Responses", options: { fontSize: 10, color: '64748B' } }
                ], {
                    x: 1.15,
                    y: 2.90,
                    w: 3.65,
                    h: 0.75,
                    valign: 'middle'
                });

                slide1.addText([
                    { text: "TOTAL ANALYTICS SLIDES\n", options: { bold: true, fontSize: 8.5, color: '64748B', charSpacing: 1 } },
                    { text: `${totalSlides - 1}`, options: { bold: true, fontSize: 16, color: '4F46E5' } },
                    { text: " Visual Charts & Tables", options: { fontSize: 10, color: '64748B' } }
                ], {
                    x: 5.25,
                    y: 2.90,
                    w: 3.65,
                    h: 0.75,
                    valign: 'middle'
                });

                let targetPeriodText = yearParam;
                if (currentData.applied_date_filter && currentData.applied_date_filter.human_readable) {
                    targetPeriodText = currentData.applied_date_filter.human_readable;
                    if (yearParam && yearParam !== 'All Academic Years') {
                        targetPeriodText += ` (${yearParam})`;
                    }
                }

                slide1.addText([
                    { text: "TARGET PERIOD / DATE RANGE\n", options: { bold: true, fontSize: 8.5, color: '64748B', charSpacing: 1 } },
                    { text: `${targetPeriodText}`, options: { bold: true, fontSize: 12, color: '0F172A' } }
                ], {
                    x: 1.15,
                    y: 3.85,
                    w: 3.65,
                    h: 0.75,
                    valign: 'middle'
                });

                slide1.addText([
                    { text: "REPORT GENERATED DATE\n", options: { bold: true, fontSize: 8.5, color: '64748B', charSpacing: 1 } },
                    { text: `${dateStr}`, options: { bold: true, fontSize: 13, color: 'D97706' } }
                ], {
                    x: 5.25,
                    y: 3.85,
                    w: 3.65,
                    h: 0.75,
                    valign: 'middle'
                });

                slide1.addText('Confidential  |  Prepared for Academic Quality Audit & Accreditation Compliance', {
                    x: 0.8,
                    y: 5.15,
                    w: 8.4,
                    h: 0.3,
                    fontSize: 9,
                    color: '94A3B8',
                    align: 'center'
                });

                // ── SLIDE 2: Form Activity Timeline (Line Chart) ─────────────
                if (hasTimeline) {
                    currentSlideNum++;
                    updateProgress(currentSlideNum, totalSlides, 'Rendering Form Activity Timeline Line Chart...');

                    const tSlide = pptx.addSlide();
                    tSlide.background = { color: 'FFFFFF' };

                    tSlide.addText('CAMPAIGN VELOCITY & SUBMISSION TIMELINE', {
                        x: 0.6, y: 0.22, w: 8.8, h: 0.22,
                        fontSize: 9.5, bold: true, color: '4F46E5', charSpacing: 1
                    });

                    tSlide.addText('Form Activity & Response Velocity', {
                        x: 0.6, y: 0.45, w: 8.8, h: 0.55,
                        fontSize: 16, bold: true, color: '0F172A', valign: 'top'
                    });

                    const tlData = currentData.submission_timeline;
                    const peakLabel = tlData.peak_month || tlData.peak_day || 'N/A';
                    const rangeLabel = (tlData.start_date && tlData.end_date) ? `${tlData.start_date} – ${tlData.end_date}` : 'All Time';

                    const tlCard = document.querySelector('.timeline-activity-card');
                    let isCum = Boolean(tlData._isCumulative);
                    let gran = tlData._currentGranularity || (tlData.daily && tlData.daily.length > 35 ? 'monthly' : 'daily');
                    if (tlCard) {
                        const cumBtn = tlCard.querySelector('.card-action-btn[title*="Cumulative"]');
                        if (cumBtn && cumBtn.classList.contains('active')) isCum = true;
                        const monthlyBtn = tlCard.querySelector('.card-action-btn[title*="Monthly"]');
                        if (monthlyBtn && monthlyBtn.classList.contains('active')) {
                            gran = 'monthly';
                            if (!cumBtn || !cumBtn.classList.contains('active')) isCum = false;
                        }
                        const dailyBtn = tlCard.querySelector('.card-action-btn[title*="Daily"]');
                        if (dailyBtn && dailyBtn.classList.contains('active')) {
                            gran = 'daily';
                            if (!cumBtn || !cumBtn.classList.contains('active')) isCum = false;
                        }
                    }

                    const tlBadge = isCum ? '📈 Cumulative Growth Curve' : (gran === 'monthly' ? '🗓️ Monthly Spikes' : '📅 Daily Spikes');
                    tSlide.addText(`👥 Total Submissions: ${tlData.total_count}    |    ⚡ Peak Activity: ${peakLabel}    |    ${tlBadge}`, {
                        x: 0.6, y: 1.05, w: 8.8, h: 0.25,
                        fontSize: 9.5, color: '64748B'
                    });

                    const liveTlCanvas = tlCard ? tlCard.querySelector('canvas') : null;
                    let tlImage = (liveTlCanvas && liveTlCanvas.width > 50 && tlCard.querySelector('.chart-container')?.style.display !== 'none') ? getLiveCanvasDataUrl(liveTlCanvas) : null;
                    if (!tlImage) {
                        tlImage = await renderTimelineChartImage(tlData, isCum, gran);
                    }
                    if (tlImage) {
                        tSlide.addImage({
                            data: tlImage,
                            x: 0.60, y: 1.35, w: 5.25, h: 3.65
                        });
                    }

                    tSlide.addShape(pptx.shapes.RECTANGLE, {
                        x: 6.05, y: 1.35, w: 3.35, h: 1.05,
                        fill: { color: 'FEF3C7' },
                        line: { color: 'FCD34D', width: 1 }
                    });
                    tSlide.addText([
                        { text: "⚡ PEAK RESPONSE PERIOD\n", options: { bold: true, fontSize: 8.5, color: '92400E', charSpacing: 1 } },
                        { text: `${peakLabel}\n`, options: { bold: true, fontSize: 13, color: 'B45309' } },
                        { text: `Total Submissions: ${tlData.total_count} Responses`, options: { fontSize: 9.5, color: '78350F' } }
                    ], {
                        x: 6.15, y: 1.40, w: 3.15, h: 0.95, valign: 'middle'
                    });

                    const series = (tlData.monthly && tlData.monthly.length >= 2) ? tlData.monthly : tlData.daily;
                    const tableItems = (series || []).slice(-8);
                    const tlTableRows = [
                        [
                            { text: (tlData.monthly && tlData.monthly.length >= 2) ? 'Month' : 'Date', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'left', margin: [2, 4, 2, 4] } },
                            { text: 'Count', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: 'Share', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: 'Total', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'center', margin: [2, 4, 2, 4] } }
                        ]
                    ];

                    tableItems.forEach((item, idx) => {
                        const bg = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
                        tlTableRows.push([
                            { text: item.label, options: { fill: { color: bg }, color: '334155', fontSize: 8, align: 'left', margin: [2, 4, 2, 4] } },
                            { text: String(item.count), options: { fill: { color: bg }, color: 'B32B2B', bold: true, fontSize: 8, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: `${item.percentage}%`, options: { fill: { color: bg }, color: '475569', fontSize: 8, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: String(item.cumulative), options: { fill: { color: bg }, color: '0284C7', bold: true, fontSize: 8, align: 'center', margin: [2, 4, 2, 4] } }
                        ]);
                    });

                    tSlide.addTable(tlTableRows, {
                        x: 6.05, y: 2.50, w: 3.35,
                        colW: [1.35, 0.60, 0.70, 0.70],
                        rowH: 0.26,
                        margin: [2, 4, 2, 4],
                        border: { pt: 0.5, color: 'E2E8F0' },
                        align: 'left', valign: 'middle'
                    });

                    addSlideFooter(tSlide, currentSlideNum);
                }

                // ── SLIDE 3: Multi-Year Institutional Performance (YoY Line Chart) ─
                if (hasYoY) {
                    currentSlideNum++;
                    updateProgress(currentSlideNum, totalSlides, 'Rendering Multi-Year Institutional YoY Performance Trend...');

                    const ySlide = pptx.addSlide();
                    ySlide.background = { color: 'FFFFFF' };

                    ySlide.addText('INSTITUTIONAL ACCREDITATION & QUALITY AUDIT (NAAC / IQAC)', {
                        x: 0.6, y: 0.22, w: 8.8, h: 0.22,
                        fontSize: 9.5, bold: true, color: '4F46E5', charSpacing: 1
                    });

                    ySlide.addText('Multi-Year Institutional Performance (YoY Trend)', {
                        x: 0.6, y: 0.45, w: 8.8, h: 0.55,
                        fontSize: 16, bold: true, color: '0F172A', valign: 'top'
                    });

                    const yoyData = currentData.yoy_trend;
                    const firstYear = yoyData.years[0];
                    const lastYear = yoyData.years[yoyData.years.length - 1];

                    const yoyCard = document.querySelector('.yoy-trend-card');
                    let yoyMode = yoyData._currentMode || 'overall';
                    if (yoyCard) {
                        const catBtn = yoyCard.querySelector('.card-action-btn[title*="Parameter Group"]');
                        if (catBtn && catBtn.classList.contains('active')) yoyMode = 'categories';
                        const overallBtn = yoyCard.querySelector('.card-action-btn[title*="Overall"]');
                        if (overallBtn && overallBtn.classList.contains('active')) yoyMode = 'overall';
                    }

                    const yoyBadge = yoyMode === 'categories' ? '🏷️ Parameter Groups Trajectory' : '🏛️ Overall Trajectory vs IQAC Benchmark';
                    ySlide.addText(`📅 Evaluated: ${yoyData.total_years} Academic Years (${firstYear} – ${lastYear})    |    ${yoyBadge}    |    🎯 IQAC Target: 4.0 / 5.0`, {
                        x: 0.6, y: 1.05, w: 8.8, h: 0.25,
                        fontSize: 9.5, color: '64748B'
                    });

                    const liveYoyCanvas = yoyCard ? yoyCard.querySelector('canvas') : null;
                    let yoyImage = (liveYoyCanvas && liveYoyCanvas.width > 50 && yoyCard.querySelector('.chart-container')?.style.display !== 'none') ? getLiveCanvasDataUrl(liveYoyCanvas) : null;
                    if (!yoyImage) {
                        yoyImage = await renderYoYChartImage(yoyData, yoyMode);
                    }
                    if (yoyImage) {
                        ySlide.addImage({
                            data: yoyImage,
                            x: 0.60, y: 1.35, w: 5.25, h: 3.65
                        });
                    }

                    ySlide.addShape(pptx.shapes.RECTANGLE, {
                        x: 6.05, y: 1.35, w: 3.35, h: 1.00,
                        fill: { color: 'ECFDF5' },
                        line: { color: 'A7F3D0', width: 1 }
                    });
                    const trajText = yoyData.latest_trajectory === 'improving' ? '↗ IMPROVING TRAJECTORY' : (yoyData.latest_trajectory === 'declining' ? '↘ DECLINING TRAJECTORY' : '➡️ STABLE TRAJECTORY');
                    ySlide.addText([
                        { text: `${trajText}\n`, options: { bold: true, fontSize: 8.5, color: '065F46', charSpacing: 1 } },
                        { text: `Target Benchmark: 4.0 / 5.0\n`, options: { bold: true, fontSize: 12, color: '047857' } },
                        { text: `Continuous Improvement Across ${yoyData.total_years} Academic Years`, options: { fontSize: 9, color: '065F46' } }
                    ], {
                        x: 6.15, y: 1.40, w: 3.15, h: 0.90, valign: 'middle'
                    });

                    const yoyTableRows = [
                        [
                            { text: 'Academic Year', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'left', margin: [2, 4, 2, 4] } },
                            { text: 'Count', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: 'Score (/5.0)', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: 'Grade', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: 'YoY Growth', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'center', margin: [2, 4, 2, 4] } }
                        ]
                    ];

                    (yoyData.overall_series || []).forEach((ys, idx) => {
                        const bg = idx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
                        let growthText = '— Baseline';
                        let growthColor = '64748B';
                        if (ys.yoy_score_change !== null && ys.yoy_score_change !== undefined) {
                            if (ys.yoy_score_change > 0) {
                                growthText = `+${ys.yoy_score_change} (${ys.yoy_pct_change}%) ↗`;
                                growthColor = '059669';
                            } else if (ys.yoy_score_change < 0) {
                                growthText = `${ys.yoy_score_change} (${ys.yoy_pct_change}%) ↘`;
                                growthColor = 'DC2626';
                            } else {
                                growthText = '0.00 (0.0%) →';
                            }
                        }

                        yoyTableRows.push([
                            { text: ys.label, options: { fill: { color: bg }, color: '0F172A', bold: true, fontSize: 8, align: 'left', margin: [2, 4, 2, 4] } },
                            { text: `${ys.count}`, options: { fill: { color: bg }, color: '334155', fontSize: 8, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: `${ys.score_5}`, options: { fill: { color: bg }, color: 'B32B2B', bold: true, fontSize: 8, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: ys.grade ? ys.grade.split(' ')[0] : 'N/A', options: { fill: { color: bg }, color: '4F46E5', bold: true, fontSize: 8, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: growthText, options: { fill: { color: bg }, color: growthColor, bold: true, fontSize: 8, align: 'center', margin: [2, 4, 2, 4] } }
                        ]);
                    });

                    ySlide.addTable(yoyTableRows, {
                        x: 6.05, y: 2.45, w: 3.35,
                        colW: [0.95, 0.45, 0.65, 0.55, 0.75],
                        rowH: 0.28,
                        margin: [2, 4, 2, 4],
                        border: { pt: 0.5, color: 'E2E8F0' },
                        align: 'left', valign: 'middle'
                    });

                    addSlideFooter(ySlide, currentSlideNum);
                }

                // ── SLIDES 4+: Comparative & Grouped Rating Scale Matrices ──────
                for (let cIdx = 0; cIdx < comparativeGroupsToExport.length; cIdx++) {
                    const cg = comparativeGroupsToExport[cIdx];
                    currentSlideNum++;
                    updateProgress(currentSlideNum, totalSlides, `Rendering Comparative Analysis: ${cg.group_name}...`);

                    let cgCard = cg._domCard || (cg.group_name ? document.querySelector(`.chart-card[data-group-name="${CSS.escape(cg.group_name)}"]`) : null);
                    if (!cgCard) {
                        const allCards = document.querySelectorAll('.chart-card');
                        for (const card of allCards) {
                            const titleEl = card.querySelector('.chart-title');
                            if (titleEl && titleEl.textContent.trim().includes((cg.group_name || '').trim())) {
                                cgCard = card;
                                break;
                            }
                        }
                    }

                    let activeType = cg._currentChartType || 'stacked';
                    if (cgCard) {
                        const activeBtn = cgCard.querySelector('.card-action-btn.active');
                        if (activeBtn && activeBtn.dataset.view && activeBtn.dataset.view !== 'table') {
                            activeType = activeBtn.dataset.view;
                        }
                    }

                    let headerPill = 'COMPARATIVE CRITERIA BENCHMARKING (100% STACKED BAR)';
                    let subPill = '📊 100% Stacked Bar Distribution Across Options';
                    if (activeType === 'diverging') {
                        headerPill = 'COMPARATIVE CRITERIA BENCHMARKING (DIVERGING LIKERT SCALE)';
                        subPill = '⚖️ Diverging Likert Scale (Positive vs Negative Response Distribution)';
                    } else if (activeType === 'radar') {
                        headerPill = 'COMPARATIVE CRITERIA BENCHMARKING (RADAR / SPIDER VIEW)';
                        subPill = '🕸️ Multi-Axis Strength & Performance Profile';
                    }

                    const cSlide = pptx.addSlide();
                    cSlide.background = { color: 'FFFFFF' };

                    cSlide.addText(headerPill, {
                        x: 0.6, y: 0.22, w: 8.8, h: 0.22,
                        fontSize: 9.5, bold: true, color: '4F46E5', charSpacing: 1
                    });

                    cSlide.addText(`${cg.group_name} — Comparative Analysis`, {
                        x: 0.6, y: 0.45, w: 8.8, h: 0.55,
                        fontSize: 15, bold: true, color: '0F172A', valign: 'top'
                    });

                    cSlide.addText(`📝 Parameters Compared: ${cg.questions.length} Questions    |    ${subPill}`, {
                        x: 0.6, y: 1.05, w: 8.8, h: 0.25,
                        fontSize: 9.5, color: '64748B'
                    });

                    const liveCgCanvas = cgCard ? cgCard.querySelector('canvas') : null;
                    let stackImage = (liveCgCanvas && liveCgCanvas.width > 50 && cgCard.querySelector('.chart-container')?.style.display !== 'none') ? getLiveCanvasDataUrl(liveCgCanvas) : null;
                    if (!stackImage) {
                        stackImage = await renderGroupMatrixChartImage(cg, cg.questions, cg.options, activeType);
                    }
                    if (stackImage) {
                        cSlide.addImage({
                            data: stackImage,
                            x: 0.60, y: 1.35, w: 5.30, h: 3.65
                        });
                    }

                    const sortedQuestions = [...cg.questions].sort((a, b) => (b.weighted_score || 0) - (a.weighted_score || 0));
                    const maxRows = Math.min(sortedQuestions.length, 9);
                    const tableSlice = sortedQuestions.slice(0, maxRows);

                    const cgTableRows = [
                        [
                            { text: 'Ranked Parameter Statement', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'left', margin: [2, 4, 2, 4] } },
                            { text: 'Avg /5.0', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: 'Positive', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: 8.5, align: 'center', margin: [2, 4, 2, 4] } }
                        ]
                    ];

                    tableSlice.forEach((q, qIdx) => {
                        const bg = qIdx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
                        const qText = q.question.length > 40 ? q.question.substring(0, 38) + '...' : q.question;
                        const score = q.weighted_score ? Number(q.weighted_score).toFixed(2) : 'N/A';
                        const pos = q.positive_rate !== undefined ? `${q.positive_rate}%` : 'N/A';

                        cgTableRows.push([
                            { text: `${qIdx + 1}. ${qText}`, options: { fill: { color: bg }, color: '334155', fontSize: 8, align: 'left', margin: [2, 4, 2, 4] } },
                            { text: score, options: { fill: { color: bg }, color: 'B32B2B', bold: true, fontSize: 8, align: 'center', margin: [2, 4, 2, 4] } },
                            { text: pos, options: { fill: { color: bg }, color: '059669', bold: true, fontSize: 8, align: 'center', margin: [2, 4, 2, 4] } }
                        ]);
                    });

                    cSlide.addTable(cgTableRows, {
                        x: 6.05, y: 1.35, w: 3.35,
                        colW: [2.05, 0.65, 0.65],
                        rowH: tableSlice.length > 6 ? 0.28 : 0.34,
                        margin: [2, 4, 2, 4],
                        border: { pt: 0.5, color: 'E2E8F0' },
                        align: 'left', valign: 'middle'
                    });

                    addSlideFooter(cSlide, currentSlideNum);
                }

                // ── SLIDES N+: Individual Question Deep-Dive Slides ──────────
                for (let i = 0; i < questionsToExport.length; i++) {
                    const item = questionsToExport[i];
                    const q = item.q;
                    currentSlideNum++;

                    updateProgress(currentSlideNum, totalSlides, `Rendering Question ${i + 1} of ${questionsToExport.length}...`);

                    const qSlide = pptx.addSlide();
                    qSlide.background = { color: 'FFFFFF' };

                    let categoryTag = 'QUESTION EVALUATION & RESPONSE BREAKDOWN';
                    const cleanQText = String(q.question || '').trim().toLowerCase();
                    const cleanGrpName = String(item.groupName || '').trim().toLowerCase();
                    const cleanSecName = String(q.section_name || '').trim();

                    if (cleanSecName && cleanSecName.toLowerCase() !== cleanQText) {
                        categoryTag = cleanSecName.toUpperCase();
                    } else if (cleanGrpName && cleanGrpName !== cleanQText && !cleanGrpName.startsWith('ungrouped')) {
                        categoryTag = item.groupName.toUpperCase();
                    } else if (formTitle) {
                        categoryTag = formTitle.toUpperCase();
                    }

                    qSlide.addText(categoryTag, {
                        x: 0.6,
                        y: 0.22,
                        w: 8.8,
                        h: 0.22,
                        fontSize: 9.5,
                        bold: true,
                        color: '4F46E5',
                        charSpacing: 1
                    });

                    const qTitleText = `Q${i + 1}. ${q.question || 'Question'}`;
                    const qTitleFontSize = qTitleText.length > 90 ? 12 : (qTitleText.length > 60 ? 13 : 14);

                    qSlide.addText(qTitleText, {
                        x: 0.6,
                        y: 0.45,
                        w: 8.8,
                        h: 0.65,
                        fontSize: qTitleFontSize,
                        bold: true,
                        color: '0F172A',
                        wrap: true,
                        valign: 'top'
                    });

                    const labels = Object.keys(q.tallies || {});
                    const dataValues = Object.values(q.tallies || {});
                    const totalSum = dataValues.reduce((acc, curr) => acc + (typeof curr === 'number' ? curr : 0), 0);
                    const totalAns = q.total_answered !== undefined ? q.total_answered : totalSum;
                    const qType = String(q.type || '').toLowerCase();

                    let domCard = q._domCard || (q.id ? document.querySelector(`.chart-card[data-qid="${q.id}"]`) : null);
                    if (!domCard) {
                        const allCards = document.querySelectorAll('.chart-card');
                        for (const card of allCards) {
                            const titleEl = card.querySelector('.chart-title');
                            if (titleEl && titleEl.textContent.trim().includes((q.question || '').trim().substring(0, 30))) {
                                domCard = card;
                                break;
                            }
                        }
                    }

                    let activeType = q._currentChartType;
                    if (domCard) {
                        const activeBtn = domCard.querySelector('.card-action-btn.active');
                        if (activeBtn && activeBtn.dataset.view && activeBtn.dataset.view !== 'table') {
                            activeType = activeBtn.dataset.view;
                        }
                    }
                    if (!activeType || activeType === 'table') {
                        activeType = (qType === 'checkbox' ? 'bar' : (labels.length > 5 ? 'bar' : 'donut'));
                    }

                    const typeLabel = qType === 'checkbox' ? 'Multiple Choice Frequency' : (activeType === 'donut' ? '🍩 Donut Distribution' : (activeType === 'pie' ? '🥧 Pie Distribution' : '📊 Ranked Bar Breakdown'));

                    qSlide.addText(`👥 Total Respondents: ${totalAns}    |    📊 Evaluation Metric: ${typeLabel}`, {
                        x: 0.6,
                        y: 1.10,
                        w: 8.8,
                        h: 0.25,
                        fontSize: 9.5,
                        color: '64748B'
                    });

                    const chartImage = await renderQuestionChartImage(q, activeType);
                    if (chartImage) {
                        qSlide.addImage({
                            data: chartImage,
                            x: 0.60,
                            y: 1.35,
                            w: 5.15,
                            h: 3.65
                        });
                    }

                    const rowCount = labels.length + 2;
                    const hasScoreBox = (q.score !== undefined && q.score !== null && Number(q.score) > 0);
                    const scoreBoxH = 0.40;
                    const scoreGap = 0.08;
                    const reservedScoreH = hasScoreBox ? (scoreBoxH + scoreGap) : 0;

                    const availTop = 1.30;
                    const availBottom = 5.08;
                    const maxAvailH = availBottom - availTop;

                    let headerFontSize = 9.0;
                    let bodyFontSize = 8.5;
                    let cellPadding = [2, 4, 2, 4];
                    let rowH = 0.28;
                    let tableY = availTop;

                    if (rowCount >= 16) {
                        headerFontSize = 7.5;
                        bodyFontSize = 7.0;
                        cellPadding = [1, 2, 1, 2];
                        rowH = 0.18;
                        tableY = 1.32;
                    } else if (rowCount >= 12) {
                        headerFontSize = 8.0;
                        bodyFontSize = 7.5;
                        cellPadding = [1, 3, 1, 3];
                        rowH = 0.22;
                        const totalTableH = rowCount * rowH;
                        tableY = Number((availTop + Math.max(0, (maxAvailH - (totalTableH + reservedScoreH)) / 2)).toFixed(3));
                    } else if (rowCount >= 8) {
                        headerFontSize = 8.5;
                        bodyFontSize = 8.0;
                        cellPadding = [2, 3, 2, 3];
                        rowH = 0.25;
                        const totalTableH = rowCount * rowH;
                        tableY = Number((availTop + Math.max(0, (maxAvailH - (totalTableH + reservedScoreH)) / 2)).toFixed(3));
                    } else if (rowCount >= 5) {
                        headerFontSize = 9.0;
                        bodyFontSize = 8.5;
                        cellPadding = [2, 4, 2, 4];
                        rowH = 0.28;
                        const totalTableH = rowCount * rowH;
                        tableY = Number((availTop + Math.max(0, (maxAvailH - (totalTableH + reservedScoreH)) / 2)).toFixed(3));
                    } else {
                        headerFontSize = 9.5;
                        bodyFontSize = 9.0;
                        cellPadding = [3, 4, 3, 4];
                        rowH = 0.32;
                        const totalTableH = rowCount * rowH;
                        tableY = Number((availTop + Math.max(0, (maxAvailH - (totalTableH + reservedScoreH)) / 2)).toFixed(3));
                    }

                    const totalTableH = Number((rowCount * rowH).toFixed(3));

                    const qTableRows = [];
                    qTableRows.push([
                        { text: 'Option / Response', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: headerFontSize, margin: cellPadding, align: 'left' } },
                        { text: 'Count', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: headerFontSize, margin: cellPadding, align: 'center' } },
                        { text: 'Percentage', options: { bold: true, fill: { color: '1E293B' }, color: 'FFFFFF', fontSize: headerFontSize, margin: cellPadding, align: 'center' } }
                    ]);

                    labels.forEach((label, lIdx) => {
                        const val = dataValues[lIdx] || 0;
                        const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) + '%' : '0.0%';
                        const rowBg = lIdx % 2 === 0 ? 'FFFFFF' : 'F8FAFC';
                        qTableRows.push([
                            { text: String(label), options: { fill: { color: rowBg }, color: '334155', align: 'left', fontSize: bodyFontSize, margin: cellPadding } },
                            { text: String(val), options: { fill: { color: rowBg }, color: '0F172A', bold: true, align: 'center', fontSize: bodyFontSize, margin: cellPadding } },
                            { text: pct, options: { fill: { color: rowBg }, color: '4F46E5', bold: true, align: 'center', fontSize: bodyFontSize, margin: cellPadding } }
                        ]);
                    });

                    qTableRows.push([
                        { text: 'Total Answered', options: { bold: true, fill: { color: 'F1F5F9' }, color: '0F172A', align: 'left', fontSize: bodyFontSize, margin: cellPadding } },
                        { text: String(totalAns), options: { bold: true, fill: { color: 'F1F5F9' }, color: '0F172A', align: 'center', fontSize: bodyFontSize, margin: cellPadding } },
                        { text: '100%', options: { bold: true, fill: { color: 'F1F5F9' }, color: '0F172A', align: 'center', fontSize: bodyFontSize, margin: cellPadding } }
                    ]);

                    qSlide.addTable(qTableRows, {
                        x: 5.90,
                        y: tableY,
                        w: 3.50,
                        colW: [1.80, 0.80, 0.90],
                        rowH: rowH,
                        margin: cellPadding,
                        border: { pt: 0.5, color: 'E2E8F0' },
                        align: 'left',
                        valign: 'middle'
                    });

                    if (hasScoreBox) {
                        const scoreVal = typeof q.score === 'number' ? q.score.toFixed(2) : q.score;
                        const maxVal = q.max_score || 5;
                        const pctScore = q.score_percentage !== undefined ? q.score_percentage : ((Number(scoreVal) / maxVal) * 100).toFixed(1);
                        const ratingY = Number((tableY + totalTableH + scoreGap).toFixed(3));

                        qSlide.addShape(pptx.shapes.RECTANGLE, {
                            x: 5.90,
                            y: ratingY,
                            w: 3.50,
                            h: scoreBoxH,
                            fill: { color: 'FEF3C7' },
                            line: { color: 'FCD34D', width: 1 }
                        });

                        qSlide.addText([
                            { text: 'Score: ', options: { bold: true, color: '92400E', fontSize: 10 } },
                            { text: `⭐ ${scoreVal} / ${maxVal}`, options: { bold: true, color: 'B45309', fontSize: 11 } },
                            { text: ` (${pctScore}% Approval)`, options: { color: '78350F', fontSize: 9.5 } }
                        ], {
                            x: 5.90,
                            y: ratingY,
                            w: 3.50,
                            h: scoreBoxH,
                            align: 'center',
                            valign: 'middle'
                        });
                    }

                    addSlideFooter(qSlide, currentSlideNum);
                }

                // ── Save Presentation File and Complete ──────────────────────
                const cleanName = formTitle.replace(/[^a-zA-Z0-9_-]/g, '_');
                const finalFileName = `${cleanName}_Analytics_Presentation.pptx`;

                updateProgress(totalSlides, totalSlides, 'Compiling and saving presentation file...');
                await pptx.writeFile({ fileName: finalFileName });

                recordAnalyticsOperation(`Exported PowerPoint Presentation (${totalSlides - 1} Slides: Line Charts, Stacked Bars & Question Deep-Dives)`);

                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'success',
                        title: 'Presentation Ready!',
                        text: `Your presentation (${totalSlides - 1} content slides including Line Charts & Stacked Bars) has been downloaded.`,
                        confirmButtonColor: '#b32b2b',
                        confirmButtonText: 'Done',
                        customClass: { popup: 'ppt-clean-modal' },
                        timer: 4000,
                        timerProgressBar: true
                    });
                }
            } catch (err) {
                console.error('Error generating PPT:', err);
                if (typeof Swal !== 'undefined') {
                    Swal.fire({
                        icon: 'error',
                        title: 'Export Failed',
                        text: 'Failed to generate presentation: ' + err.message,
                        confirmButtonColor: '#b32b2b',
                        customClass: { popup: 'ppt-clean-modal' }
                    });
                } else {
                    alert('Failed to generate presentation: ' + err.message);
                }
            }
        }

        // Attach Export PPT button listener
        document.getElementById('export-ppt-btn')?.addEventListener('click', exportAnalyticsPPT);


        // View All Responses Report handler
        document.getElementById('view-responses-btn')?.addEventListener('click', function () {
            const urlParams = new URLSearchParams(window.location.search);
            const currentFormId = urlParams.get('form_id') || 1;
            const year = urlParams.get('year') || '';
            const filters = urlParams.get('filters') || '{}';
            const statusStr = selectedStatusToView || 'all';
            const dateFrom = urlParams.get('date_from') || '';
            const dateTo = urlParams.get('date_to') || '';

            window.open(`../analytics/responses_view.php?form_id=${currentFormId}&year=${encodeURIComponent(year)}&filters=${encodeURIComponent(filters)}&status=${encodeURIComponent(statusStr)}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`, '_blank');
        });

        // View Stacked Individual Reports handler
        document.getElementById('view-individual-reports-btn')?.addEventListener('click', function () {
            const urlParams = new URLSearchParams(window.location.search);
            const currentFormId = urlParams.get('form_id') || 1;
            const year = urlParams.get('year') || '';
            const filters = urlParams.get('filters') || '{}';
            const statusStr = selectedStatusToView || 'all';
            const dateFrom = urlParams.get('date_from') || '';
            const dateTo = urlParams.get('date_to') || '';

            window.open(`../analytics/individual_reports_view.php?form_id=${currentFormId}&year=${encodeURIComponent(year)}&filters=${encodeURIComponent(filters)}&status=${encodeURIComponent(statusStr)}&date_from=${encodeURIComponent(dateFrom)}&date_to=${encodeURIComponent(dateTo)}`, '_blank');
        });

        // Handle Back to Forms navigation
        document.getElementById('back-to-forms-btn')?.addEventListener('click', function () {
            flushAnalyticsSession('Closed Dashboard (Back to Forms)');
            // Force close filter sidebar before navigating back
            if (typeof window.closeAnalyticsSidebar === 'function') {
                window.closeAnalyticsSidebar();
            }
            const url = new URL(window.location);
            url.searchParams.delete('form_id');
            url.searchParams.delete('year');
            url.searchParams.delete('filters');
            url.searchParams.delete('date_from');
            url.searchParams.delete('date_to');
            window.history.pushState({}, '', url);

            populateSegments('from', '');
            populateSegments('to', '');
            if (dateFilterBanner) dateFilterBanner.style.display = 'none';
            if (resetDateBtn) resetDateBtn.style.display = 'none';

            document.getElementById('analytics-dashboard-view').style.display = 'none';
            document.getElementById('analytics-select-form-view').style.display = 'block';
            if (toggleModeBtn) toggleModeBtn.style.display = 'none';

            currentFilterableQuestions = {};
            selectedQuestionToView = 'all';
            if (questionSelector) questionSelector.value = 'all';
            document.querySelectorAll('.dynamic-filter-accordion').forEach(el => el.remove());
        });

        // Expose global refresh function
        window.refreshAnalytics = function (formId = 0) {
            fetchAnalytics(formId);
        };

        // Initialize
        const urlParams = new URLSearchParams(window.location.search);
        const initialFormId = urlParams.get('form_id') || 0;
        fetchAnalytics(initialFormId);
    } catch (e) {
        console.error('Analytics Initialization Error:', e);
    }
}


window.filterAnalyticsForms = function () {
    const input = document.getElementById('analytics-search-input');
    const clearBtn = document.getElementById('clearAnalyticsSearch');
    if (!input) return;
    const filter = input.value.toLowerCase();
    if (clearBtn) clearBtn.style.display = filter.length > 0 ? 'block' : 'none';
    const grid = document.getElementById('analytics-forms-grid');
    const cards = grid.querySelectorAll('.form-card-container');

    cards.forEach(card => {
        const titleElem = card.querySelector('.card-bright-title');
        if (!titleElem) return;
        const title = titleElem.textContent.toLowerCase();

        if (title.includes(filter)) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
};

window.clearAnalyticsSearchInput = function () {
    const input = document.getElementById('analytics-search-input');
    if (input) {
        input.value = '';
        window.filterAnalyticsForms();
    }
};

let modalChartInstance = null;

window.openChartModal = function (sourceChart, title) {
    const modal = document.getElementById('chart-modal');
    const titleEl = document.getElementById('chart-modal-title');
    const canvas = document.getElementById('chart-modal-canvas');
    if (!modal || !canvas) return;

    titleEl.textContent = title;

    if (modalChartInstance) {
        modalChartInstance.destroy();
    }

    // Copy options and add slightly larger fonts for the modal
    const newOptions = JSON.parse(JSON.stringify(sourceChart.config.options));
    newOptions.maintainAspectRatio = false;
    newOptions.responsive = true;
    newOptions.animation = { duration: 0 }; // Remove 1s delay in modal chart load

    // Deep clone data to avoid reference issues
    const newData = JSON.parse(JSON.stringify(sourceChart.config.data));
    newOptions.plugins = sourceChart.config.options.plugins || {};
    if (sourceChart.config.options.scales) {
        newOptions.scales = sourceChart.config.options.scales;
    }

    const ds = newData.datasets && newData.datasets[0] ? newData.datasets[0] : null;
    const totalSum = ds && ds.data ? ds.data.reduce((a, b) => a + (typeof b === 'number' ? b : 0), 0) : 0;
    const insightPill = document.getElementById('chart-modal-insight-pill');

    function resetInsightPill() {
        if (!insightPill) return;
        insightPill.innerHTML = `
            <span style="display:inline-flex; align-items:center; gap:6px;">
                <span>👥</span>
                <strong>Total Question Responses: ${totalSum}</strong>
                <span class="pill-sub" style="margin-left: 6px;">• Hover over any slice to inspect details</span>
            </span>
        `;
    }
    resetInsightPill();

    canvas.onmouseleave = function () {
        resetInsightPill();
    };

    // Dedicated insight card live updater on hover
    newOptions.onHover = function (event, activeElements) {
        if (!insightPill) return;
        if (activeElements && activeElements.length > 0) {
            const activeIdx = activeElements[0].index;
            const dsIdx = activeElements[0].datasetIndex || 0;
            const targetDataset = newData.datasets[dsIdx];
            const label = newData.labels[activeIdx] || '';
            const val = targetDataset.data[activeIdx] || 0;
            const pct = totalSum > 0 ? ((val / totalSum) * 100).toFixed(1) : '0.0';
            const color = Array.isArray(targetDataset.backgroundColor) ? targetDataset.backgroundColor[activeIdx] : targetDataset.backgroundColor;

            insightPill.innerHTML = `
                <span class="modal-insight-dot" style="background-color: ${color};"></span>
                <strong>${label}</strong>:
                <span style="color: var(--primary-color, #b32b2b); font-weight: 700; margin: 0 4px;">${val} responses</span>
                <span style="background: rgba(15, 23, 42, 0.08); padding: 2px 8px; border-radius: 12px; font-weight: 600; font-size: 12.5px;">${pct}%</span>
                <span class="pill-sub" style="margin-left: 4px;">of total (${totalSum})</span>
            `;
        } else {
            resetInsightPill();
        }
    };

    // Tooltip caret padding to avoid crowding canvas slices
    if (!newOptions.plugins.tooltip) newOptions.plugins.tooltip = {};
    newOptions.plugins.tooltip.caretPadding = 14;
    newOptions.plugins.tooltip.boxPadding = 6;
    newOptions.plugins.tooltip.padding = 12;
    newOptions.plugins.tooltip.cornerRadius = 8;
    newOptions.plugins.tooltip.backgroundColor = 'rgba(15, 23, 42, 0.95)';

    const modalPercentagePlugin = {
        id: 'modalPercentage',
        afterDatasetsDraw: (chart) => {
            const ctx = chart.ctx;
            ctx.save();
            ctx.font = 'bold 15px "Roboto", sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillStyle = '#0f172a';
            ctx.shadowColor = 'rgba(255, 255, 255, 0.95)';
            ctx.shadowBlur = 4;
            ctx.shadowOffsetX = 0;
            ctx.shadowOffsetY = 0;

            // Determine active/hovered elements in real time
            const activeElements = (typeof chart.getActiveElements === 'function')
                ? chart.getActiveElements()
                : (chart.tooltip?._active || []);
            const hoveredIndices = new Set(activeElements.map(el => el.index));

            chart.data.datasets.forEach((dataset, i) => {
                const meta = chart.getDatasetMeta(i);
                meta.data.forEach((element, index) => {
                    // BACK OFF: Hide the static percentage for whichever slice is actively hovered!
                    if (hoveredIndices.has(index)) return;

                    const val = dataset.data[index];
                    if (val > 0) {
                        let pctString = '';
                        try {
                            const context = { chart: chart, dataIndex: index, datasetIndex: i, dataset: dataset, raw: val, parsed: val };
                            const labelRes = chart.config.options.plugins.tooltip.callbacks.label(context);
                            const labels = Array.isArray(labelRes) ? labelRes : [labelRes];
                            for (let l of labels) {
                                if (l && l.includes('Percentage:')) {
                                    const match = l.match(/(\d+(\.\d+)?)%/);
                                    if (match) pctString = match[0];
                                    break;
                                }
                            }
                        } catch (e) { }

                        if (pctString) {
                            if (chart.config.type === 'pie' || chart.config.type === 'doughnut') {
                                const pos = element.tooltipPosition();
                                ctx.fillText(pctString, pos.x, pos.y);
                            } else if (chart.config.type === 'bar') {
                                const isHorizontal = chart.config.options.indexAxis === 'y';
                                const x = element.x;
                                const y = element.y;
                                const base = element.base;

                                if (isHorizontal) {
                                    const centerX = base + (x - base) / 2;
                                    ctx.fillText(pctString, centerX, y);
                                } else {
                                    const centerY = base + (y - base) / 2;
                                    ctx.fillText(pctString, x, centerY);
                                }
                            }
                        }
                    }
                });
            });
            ctx.restore();
        }
    };

    const modalPlugins = [];
    if (sourceChart.config.type !== 'radar') {
        modalPlugins.push(modalPercentagePlugin);
    }
    if (sourceChart.config.type === 'doughnut') {
        modalPlugins.push({
            id: 'modalDonutCenterKPI',
            beforeDraw: (chart) => {
                if (chart.config.type !== 'doughnut') return;
                const { ctx, chartArea } = chart;
                if (!chartArea) return;
                const centerX = (chartArea.left + chartArea.right) / 2;
                const centerY = (chartArea.top + chartArea.bottom) / 2;
                ctx.save();
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.font = '700 28px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillStyle = '#0f172a';
                ctx.fillText(totalSum, centerX, centerY - 10);
                ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                ctx.fillStyle = '#64748b';
                ctx.fillText('RESPONSES', centerX, centerY + 16);
                ctx.restore();
            }
        });
    }

    modalChartInstance = new Chart(canvas, {
        type: sourceChart.config.type,
        data: newData,
        options: newOptions,
        plugins: modalPlugins
    });

    modal.style.display = 'flex';
};

window.closeChartModal = function () {
    const modal = document.getElementById('chart-modal');
    if (modal) {
        modal.style.display = 'none';
    }
};

// Close modal when clicking outside
window.addEventListener('click', function (event) {
    const modal = document.getElementById('chart-modal');
    if (event.target === modal) {
        window.closeChartModal();
    }
});

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAnalytics);
} else {
    initAnalytics();
}

// Global Event Listeners to catch browser-level 'Back' button navigation
window.addEventListener('popstate', function () {
    if (typeof window.closeAnalyticsSidebar === 'function') {
        window.closeAnalyticsSidebar();
    }
});
window.addEventListener('hashchange', function () {
    if (typeof window.closeAnalyticsSidebar === 'function') {
        window.closeAnalyticsSidebar();
    }
});
