<template>
    <div class="diary-stats">
        <!-- Period Selector -->
        <StatsHeader
            v-model="selectedPeriod"
            :periods="periods"
            @export="handleExport"
        />

        <!-- Quick Stats Cards -->
    <QuickStats :stats="quickStats" />

        <!-- Charts Section -->
        <div class="charts-container scroll-container">
            <!-- Volume Chart -->
            <VolumeChart
                v-model="volumeView"
                :views="volumeViews"
                :data="volumeChartData"
                :options="volumeChartOptions"
                :legend="volumeLegend"
                :metric="volumeMetric"
                :selected-exercise-label="volumeSelectedExerciseLabel"
                @open-exercise-picker="openExercisePicker('volume')"
                @toggle-metric="toggleVolumeMetric"
            />

                                    <!-- Muscle Groups Heatmap (Apex) -->
                                    <MuscleHeatmapApex
                                        :muscle-groups="muscleGroups"
                                        :get-muscle-sets="getMuscleSets"
                                        :selected-muscles="selectedMuscles"
                                        :weeks-count="weeksCount"
                                        :get-muscle-details="getMuscleDetailsSync"
                                    />

            <!-- Intensity Distribution -->
                        <IntensityDistribution
                            :rpe-data="intensityChartData.rpe"
                            :rir-data="intensityChartData.rir"
                            :options="intensityChartOptions"
                            :zones="intensityZones"
                        />

            <!-- Progress Tracking -->
                        <ProgressChart
                            :data="progressChartData"
                            :options="progressChartOptions"
                            :progress="exerciseProgress"
                            :model-value-name="progressExerciseName"
                            @open-picker="openExercisePicker('progress')"
                        />

            <!-- Microcycle Analysis -->
            <div class="chart-card">
                <div class="chart-header">
                    <h3 class="chart-title">Анализ микроциклов</h3>
                    <div class="chart-subtitle">Корректировка нагрузки по неделям</div>
                </div>
                <div class="microcycles-timeline">
                    <div 
                        v-for="(cycle, idx) in microcycles" 
                        :key="idx"
                        class="cycle-block"
                        :class="`cycle--${cycle.type}`"
                    >
                        <div class="cycle-week">Неделя {{ cycle.week }}</div>
                        <div class="cycle-type">{{ cycle.label }}</div>
                        <div class="cycle-adjustment">
                            <van-icon :name="cycle.adjustment > 0 ? 'arrow-up' : 'arrow-down'" />
                            {{ Math.abs(cycle.adjustment) }}%
                        </div>
                        <div class="cycle-metrics">
                            <div class="cycle-metric">
                                <span class="metric-label">Объём</span>
                                <span class="metric-value">{{ cycle.volume }} сетов</span>
                            </div>
                            <div class="cycle-metric">
                                <span class="metric-label">Ср. RPE</span>
                                <span class="metric-value">{{ cycle.avgRPE }}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <!-- Recovery & Fatigue -->
            <div class="chart-card">
                <div class="chart-header">
                    <h3 class="chart-title">Восстановление и усталость</h3>
                </div>
                <div class="fatigue-indicator">
                    <div class="fatigue-gauge">
                        <div class="gauge-fill" :style="{ width: fatigueLevel + '%' }"></div>
                        <div class="gauge-markers">
                            <span class="marker" style="left: 30%">Оптимально</span>
                            <span class="marker" style="left: 70%">Перегруз</span>
                        </div>
                    </div>
                    <div class="fatigue-status" :class="`status--${fatigueStatus}`">
                        {{ fatigueStatusText }}
                    </div>
                </div>
                <div class="recovery-metrics">
                    <div class="metric-row">
                        <span class="metric-label">Дней отдыха между тренировками</span>
                        <span class="metric-value">{{ recoveryMetrics.avgRestDays }}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Острая нагрузка (7 дней)</span>
                        <span class="metric-value">{{ recoveryMetrics.acuteLoad }}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Хроническая нагрузка (28 дней)</span>
                        <span class="metric-value">{{ recoveryMetrics.chronicLoad }}</span>
                    </div>
                    <div class="metric-row">
                        <span class="metric-label">Соотношение A:C</span>
                        <span class="metric-value" :class="{ warning: recoveryMetrics.ratio > 1.5 }">
                            {{ recoveryMetrics.ratio }}
                        </span>
                    </div>
                </div>
            </div>

            <!-- Supplement Tracking -->
                        <!-- Supplements Timeline - ВРЕМЕННО ОТКЛЮЧЕНО
            <div class="chart-card" v-if="hasSupplements">
                <div class="chart-header">
                    <h3 class="chart-title">Приём добавок</h3>
                    <div class="chart-subtitle">Корреляция с производительностью</div>
                </div>
                <div class="supplements-timeline">
                    <div class="supplement-row" v-for="supp in supplementsData" :key="supp.id">
                        <div class="supplement-name">{{ supp.name }}</div>
                        <div class="supplement-periods">
                            <div 
                                v-for="period in supp.periods" 
                                :key="period.start"
                                class="period-bar"
                                :style="{
                                    left: getPeriodPosition(period.start) + '%',
                                    width: getPeriodWidth(period.start, period.end) + '%'
                                }"
                                @click="showSupplementDetails(supp, period)"
                            >
                                <span class="period-dose">{{ period.dose }}</span>
                            </div>
                        </div>
                        <div class="supplement-effect" :class="{ positive: supp.effect > 0 }">
                            {{ supp.effect > 0 ? '+' : '' }}{{ supp.effect }}%
                        </div>
                    </div>
                </div>
            </div>
            -->
        </div>
    </div>

    <!-- Exercise Picker -->
    <ThemeActionSheet
        v-model:show="showExercisePicker"
        :actions="exerciseActions"
        title="Выберите упражнение"
        cancel-text="Отмена"
        @select="onExerciseSelect"
    />
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useSessionsStore } from '@/stores/sessions';
import { useExercisesStore } from '@/stores/exercises';
import { useSupplementsStore } from '@/stores/supplements';
import { useTrainingStats } from '@/composables/useTrainingStats';
import ThemeActionSheet from '@/components/ui/ThemeActionSheet.vue';
import StatsHeader from '@/components/Diary/Stats/StatsHeader.vue';
import QuickStats from '@/components/Diary/Stats/QuickStats.vue';
import VolumeChart from '@/components/Diary/Stats/VolumeChart.vue';
import MuscleHeatmapApex from '@/components/Diary/Stats/MuscleHeatmapApex.vue';
import IntensityDistribution from '@/components/Diary/Stats/IntensityDistribution.vue';
import ProgressChart from '@/components/Diary/Stats/ProgressChart.vue';
import { showToast } from 'vant';

// Define emits
defineEmits<{
    (e: 'openRecordDetails', record: any): void;
}>();

const sessions = useSessionsStore();
const exercises = useExercisesStore();
const supplements = useSupplementsStore();
const stats = useTrainingStats();

const selectedPeriod = ref('month');
const volumeView = ref('Общий');
const volumeMetric = ref<'tonnage' | 'reps'>('tonnage');
const selectedExercise = ref<number | null>(null);
const selectedExerciseName = ref('');
const progressExerciseName = ref('');
const volumeSelectedExerciseLabel = computed(() => selectedExerciseName.value || 'Все упражнения');
const showExercisePicker = ref(false);
const pickerContext = ref<'volume' | 'progress' | null>(null);

// Кастомный оверлей тултипа для heatmap больше не используется (используем стандартный Apex tooltip)

// Реактивные данные для графиков
const quickStats = ref({ totalWorkouts: 0, workoutsTrend: 0, totalVolume: 0, volumeTrend: 0, avgIntensity: 7.2, consistency: 0, streak: 0 });
const volumeChartData = ref({ labels: [] as string[], datasets: [] as any[] });
const volumeLegend = ref([] as any[]);
const intensityChartData = ref({ rpe: { labels: [] as string[], datasets: [] as any[] }, rir: { labels: [] as string[], datasets: [] as any[] } });
const intensityZones = ref({ light: 0, moderate: 0, hard: 0 });
const topExercises = ref([] as any[]);
const progressChartData = ref(null as any);
const exerciseProgress = ref(null as any);
const progressExerciseId = ref<number | null>(null);

const periods = [
    { label: 'Неделя', value: 'week' },
    { label: 'Месяц', value: 'month' },
    { label: '3 месяца', value: 'quarter' },
    { label: 'Год', value: 'year' }
];
const volumeViews = ['Общий', 'Верх', 'Низ', 'Кор'];

// Реальные данные вместо моков
const microcycles = ref([] as any[]);
const fatigueLevel = ref(0);
const fatigueStatus = computed(() => sessions.getFatigueStatus(fatigueLevel.value));
const fatigueStatusText = computed(() => sessions.getFatigueStatusText(fatigueStatus.value));
const recoveryMetrics = ref({ avgRestDays: 0, acuteLoad: 0, chronicLoad: 0, ratio: 0 });

// (heatmap tooltip handler removed after switching to Radar)

// Загрузка данных статистики
const loadStatsData = async () => {
    // log removed
    
    try {
        // Загружаем все данные параллельно
        const [
            quickStatsData,
            _volumeData,
            intensityData,
            zonesData,
            exercisesData
        ] = await Promise.all([
            stats.getQuickStats(selectedPeriod.value),
            stats.getVolumeChart(selectedPeriod.value, volumeView.value, volumeMetric.value, selectedExercise.value || undefined),
            stats.getIntensityChart(selectedPeriod.value),
            stats.getIntensityZones(selectedPeriod.value),
            stats.getTopExercises(selectedPeriod.value)
        ]);

        quickStats.value = quickStatsData;
        volumeChartData.value = _volumeData;
        intensityChartData.value = intensityData;
        intensityZones.value = zonesData;
        topExercises.value = exercisesData;

    // Defaults:
    // - Volume: All exercises (selectedExercise = null)
    // - Progress: select first exercise by default
    if (!progressExerciseId.value && exercisesData.length > 0) {
        const first = exercisesData[0];
        progressExerciseId.value = first.id;
        progressExerciseName.value = first.name;
        await loadExerciseProgress(first.id);
    }

        // Легенда подстраивается под выбранную метрику
        // Легенда учитывает фильтр по упражнению
        try {
            const totals = await stats.getMetricTotals(selectedPeriod.value, volumeMetric.value, selectedExercise.value || undefined);
            volumeLegend.value = [
                { label: 'Текущий период', value: String(totals.current), color: 'var(--color-accent)' },
                { label: 'Предыдущий', value: String(totals.previous), color: 'var(--color-text-muted)' }
            ];
        } catch {
            volumeLegend.value = [
                { label: 'Текущий период', value: (volumeMetric.value === 'tonnage' ? quickStatsData.totalTonnage : quickStatsData.totalVolume).toString(), color: 'var(--color-accent)' },
                { label: 'Предыдущий', value: (volumeMetric.value === 'tonnage' ? quickStatsData.prevTonnage : quickStatsData.prevVolume).toString(), color: 'var(--color-text-muted)' }
            ];
        }

        // Загружаем данные по мышечным группам
        await loadMuscleData();

        // Загружаем реальные данные для микроциклов и восстановления
        try {
            const [microcyclesData, fatigueLevelData, recoveryData] = await Promise.all([
                stats.getMicrocycles(selectedPeriod.value),
                stats.getFatigueLevel(),
                stats.getRecoveryMetrics()
            ]);

            microcycles.value = microcyclesData;
            fatigueLevel.value = fatigueLevelData;
            recoveryMetrics.value = recoveryData;

            // log removed
        } catch (error) {
            console.error('[DiaryTabStats] Ошибка загрузки дополнительных данных:', error);
        }

    } catch (error) {
        console.error('[DiaryTabStats] Ошибка загрузки статистики:', error);
        showToast('Ошибка загрузки статистики');
    }
};

// Обновление данных при смене периода
const updateStatsForPeriod = () => {
    if ((stats as any).refreshAll) {
        void (stats as any).refreshAll(selectedPeriod.value, { view: volumeView.value, metric: volumeMetric.value, exerciseId: selectedExercise.value });
    }
    loadStatsData();
};

// Вотчеры для автообновления
import { watch } from 'vue';
watch(selectedPeriod, updateStatsForPeriod);
watch(volumeView, updateStatsForPeriod);
watch(volumeMetric, updateStatsForPeriod);

function toggleVolumeMetric() {
    volumeMetric.value = volumeMetric.value === 'tonnage' ? 'reps' : 'tonnage'
}

// Chart options (из sessions store)
const volumeChartOptions = sessions.getVolumeChartOptions();
const intensityChartOptions = sessions.getIntensityChartOptions();
const progressChartOptions = sessions.getProgressChartOptions();

// Muscle groups heatmap
const muscleGroups = computed(() => exercises.muscles.map(m => m.name));
const muscleData = ref({} as Record<string, Record<number, number>>);
const muscleDetails = ref({} as Record<string, Record<number, { primary: number; secondary: number; exercises: string[] }>>)
// Поддержка фильтра мышц из модалки (пока все)
const selectedMuscles = computed(() => muscleGroups.value)
// Счёт недель от выбора периода (по умолчанию 4)
const weeksCount = computed(() => selectedPeriod.value === 'month' ? 4 : selectedPeriod.value === 'quarter' ? 12 : selectedPeriod.value === 'year' ? 52 : 1)

async function loadMuscleData() {
    const data: Record<string, Record<number, number>> = {};
    const weeks = weeksCount.value || 4;
    for (const muscle of muscleGroups.value) {
        data[muscle] = {};
        for (let week = 1; week <= weeks; week++) {
            data[muscle][week] = await stats.getMuscleSets(muscle, week);
        }
    }
    muscleData.value = data;
        // Префетч деталей для тултипов (чтобы tooltip работал синхронно)
        const det: Record<string, Record<number, { primary: number; secondary: number; exercises: string[] }>> = {}
        for (const muscle of muscleGroups.value) {
            det[muscle] = {}
            for (let week = 1; week <= weeks; week++) {
                try {
                    det[muscle][week] = await stats.getMuscleDetails(muscle, week)
                } catch {
                    det[muscle][week] = { primary: 0, secondary: 0, exercises: [] }
                }
            }
        }
        muscleDetails.value = det
}

function getMuscleSets(muscle: string, week: number) {
    return muscleData.value[muscle]?.[week] || 0;
}
function getMuscleDetailsSync(muscle: string, week: number) {
    return muscleDetails.value[muscle]?.[week]
}
// (heatmap color/opacity helpers no longer used)

// Показ кастомного тултипа удалён — Apex показывает значения автоматически

// Progress tracking
const exerciseActions = computed(() => {
    const all = [{ name: 'Все упражнения', value: null }];
    const list = topExercises.value.map((ex: any) => ({ name: ex.name, value: ex.id }));
    // Для Volume показываем вариант "Все упражнения", для Progress — только конкретные
    return pickerContext.value === 'progress' ? list : [...all, ...list];
});

async function onExerciseSelect(action: any) {
    // log removed
    showExercisePicker.value = false;

    if (pickerContext.value === 'progress') {
        if (!action || action.value == null) return;
        progressExerciseId.value = action.value;
        progressExerciseName.value = action.name;
        await loadExerciseProgress(action.value);
        return;
    }

    // Volume context — поддерживает "Все упражнения"
    selectedExercise.value = action?.value ?? null;
    selectedExerciseName.value = action?.value ? action.name : '';
    const vol = await stats.getVolumeChart(selectedPeriod.value, volumeView.value, volumeMetric.value, selectedExercise.value || undefined);
    volumeChartData.value = vol;
    const totals = await stats.getMetricTotals(selectedPeriod.value, volumeMetric.value, selectedExercise.value || undefined);
    volumeLegend.value = [
        { label: 'Текущий период', value: String(totals.current), color: 'var(--color-accent)' },
        { label: 'Предыдущий', value: String(totals.previous), color: 'var(--color-text-muted)' }
    ];
}

function openExercisePicker(ctx: 'volume' | 'progress') {
    pickerContext.value = ctx;
    showExercisePicker.value = true;
}

async function loadExerciseProgress(exerciseId: number) {
    try {
        const progress = await stats.getExerciseProgress(exerciseId, selectedPeriod.value);
        exerciseProgress.value = progress;

        // Создаём данные для графика прогресса
        if (progress.weightHistory && progress.weightHistory.length > 0) {
            const labels = progress.weightHistory.map((h: any) => h.date);
            const weightData = progress.weightHistory.map((h: any) => h.weight);
            // Attach per-point RPE/RIR metadata for tooltip
            const pointMeta = progress.weightHistory.map((h: any) => ({ rpe: h.rpe, rir: h.rir }));

            progressChartData.value = {
                labels,
                datasets: [
                    { 
                        label: 'Рабочий вес', 
                        data: weightData, 
                        borderColor: 'var(--color-accent)', 
                        tension: 0.3, 
                        yAxisID: 'y' 
                    }
                ]
            };
            // Store meta so tooltip can access it via apex options
            // Using a convention: put in options.dataLabels.__meta
            // Note: LineChart.vue reads this and renders it
            (progressChartOptions as any).dataLabels = { ...(progressChartOptions as any).dataLabels, __meta: pointMeta };
        } else {
            progressChartData.value = null;
        }
    } catch (error) {
        console.error('[DiaryTabStats] Ошибка загрузки прогресса упражнения:', error);
        exerciseProgress.value = null;
        progressChartData.value = null;
    }
}

function handleExport() {
    showToast('Экспорт статистики в разработке');
}

onMounted(() => {
    // log removed
    sessions.loadTrainingHistory();
    exercises.loadMuscles();
    supplements.loadAll();
    
    // Загружаем статистику после загрузки основных данных
    setTimeout(async () => {
        // Warm caches to show instantly; trigger background refresh
        await stats.getTopExercises(selectedPeriod.value);
        await stats.getQuickStats(selectedPeriod.value);
        await stats.getVolumeChart(selectedPeriod.value, volumeView.value, volumeMetric.value, selectedExercise.value || undefined);
        await stats.getIntensityChart(selectedPeriod.value);
        await stats.getIntensityZones(selectedPeriod.value);
        await stats.getMetricTotals(selectedPeriod.value, volumeMetric.value, selectedExercise.value || undefined);
        // Also kick a consolidated background refresh but don’t await
        if ((stats as any).refreshAll) {
            void (stats as any).refreshAll(selectedPeriod.value, { view: volumeView.value, metric: volumeMetric.value, exerciseId: selectedExercise.value });
        }
        loadStatsData();
    }, 500);
});
</script>

<style lang="scss">
.diary-stats {
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: visible; // Позволяем тултипам показываться за границами
}

// Header
.stats-header {
    padding: 0 var(--space-4) var(--space-2); // Уменьшил верхний и нижний отступ
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: var(--space-3);
}

.period-selector {
    display: flex;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-l);
    padding: var(--space-1);
    gap: var(--space-1);
}

.period-btn {
    background: transparent;
    border: none;
    border-radius: var(--radius-m);
    padding: var(--space-1) var(--space-2); // Уменьшил padding
    font-size: var(--fs-xs); // Уменьшил шрифт
    font-weight: var(--fw-medium);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--dur-2) var(--ease-std);

    &:hover {
        background: var(--color-elevated);
    }

    &.active {
        background: var(--color-accent);
        color: var(--color-accent-contrast);
    }
}

.export-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 40px;
    height: 40px;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-m);
    color: var(--color-text);
    cursor: pointer;
    transition: all var(--dur-2) var(--ease-std);

    &:hover {
        background: var(--color-accent);
        color: var(--color-accent-contrast);
        border-color: var(--color-accent);
    }
}

// Quick stats
.quick-stats {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-2); // Уменьшил отступы между карточками
    padding: 0 var(--space-4);
    margin-bottom: var(--space-3); // Уменьшил отступ снизу
}

.stat-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-l);
    padding: var(--space-1) var(--space-3);  // Уменьшил с space-4
    display: grid;
    grid-template-columns: repeat(3, 33%);
    justify-items: center;
    align-items: center;
    height: 20px; // Уменьшил высоту карточки

    &__value {
        order: 2;
        font-size: var(--fs-xxs); // Уменьшил с fs-xl
        color: var(--color-text);
    
    }

    &__label {
        order: 1;
        font-size: var(--fs-xxs);
        color: var(--color-text-muted);
    
    }

    &__trend {
        order: 3;
        display: flex;
        align-items: center;
        gap: var(--space-1);
        font-size: var(--fs-xxs);
        color: var(--color-text-muted);

        &.positive {
            color: var(--color-success);
        }

        &.neutral {
            color: var(--color-warning);
        }
    }
}

// Charts container
.charts-container {
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: 0 var(--space-4) calc(90px + var(--tabbar-height, 54px) + var(--safe-bottom, env(safe-area-inset-bottom)) + var(--ime-bottom, 0px)); // Нижний отступ + безопасная зона + меню
    height: 0; // Трюк для правильного flex: 1 со скроллом
}

.chart-card {
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-l);
    padding: var(--space-3); // Уменьшил с space-4
    margin-bottom: var(--space-3); // Уменьшил с space-4
    overflow: visible; // Позволяем тултипам показываться
    position: relative; // Для корректного позиционирования тултипов
}

.chart-header {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    align-items: start;
    margin-bottom: var(--space-4);
}

.chart-title {
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    color: var(--color-text);
    margin: 0;
}

.chart-subtitle {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
    margin-top: var(--space-1);
}

.chart-controls {
    display: flex;
    gap: var(--space-1);
}

.chart-view-btn {
    background: transparent;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-s);
    padding: var(--space-1) var(--space-2);
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
    cursor: pointer;
    transition: all var(--dur-2) var(--ease-std);

    &:hover {
        border-color: var(--color-accent);
        color: var(--color-accent);
    }

    &.active {
        background: var(--color-accent);
        color: var(--color-accent-contrast);
        border-color: var(--color-accent);
    }
}

.chart-content {
    height: 200px;
    margin-bottom: var(--space-3);
}

.chart-legend {
    display: flex;
    gap: var(--space-4);
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
}

.legend-item {
    display: flex;
    align-items: center;
    gap: var(--space-2);
}

.legend-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
}

.legend-label {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
}

.legend-value {
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    color: var(--color-text);
    margin-left: auto;
}

// Heatmap
.heatmap-content {
    padding: var(--space-3) 0;
}

.heatmap-grid {
   
    display: flex;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
}

.heatmap-labels {
    padding-top: 30px;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    width: 80px;
}

.heatmap-label {
    height: 28px;
    display: flex;
    align-items: center;
    font-size: var(--fs-xs);
    color: var(--color-text);
    font-weight: var(--fw-medium);
}

.heatmap-weeks {
    flex: 1;
    display: flex;
    gap: var(--space-2);
}

.heatmap-week {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.heatmap-week-label {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
    text-align: center;
    margin-bottom: var(--space-1);
}

.heatmap-cell-wrapper {
    position: relative;
}

.heatmap-cell {
    height: 28px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: var(--radius-s);
    font-size: var(--fs-xs);
    font-weight: var(--fw-semibold);
    color: var(--color-surface);
    cursor: pointer;
    transition: all var(--dur-2) var(--ease-std);

    &:hover {
        transform: scale(1.1);
        box-shadow: var(--shadow-md);
    }
}

.heatmap-scale {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    padding: 0 var(--space-3);
}

.scale-label {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
}

.scale-gradient {
    flex: 1;
    height: 8px;
    background: linear-gradient(90deg, 
        var(--color-success) 0%, 
        var(--color-warning) 50%, 
        var(--color-accent) 100%);
    border-radius: var(--radius-pill);
}

// Intensity zones
.intensity-zones {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
    padding-top: var(--space-8);
    border-top: 1px solid var(--color-border);
    overflow: hidden;
}

.zone {
    display: grid;
    grid-template-columns: 100px 1fr auto;
    align-items: center;
    gap: var(--space-3);
    overflow: hidden;
    width: 80;
}

.zone-bar {
    height: 8px;
    border-radius: var(--radius-pill);
    transition: width var(--dur-3) var(--ease-std);

    /* Align with charts: use a single accent hue with varying opacity */
    .zone--light & { background: color-mix(in srgb, var(--color-accent) 35%, transparent); }
    .zone--moderate & { background: color-mix(in srgb, var(--color-accent) 60%, transparent); }
    .zone--hard & { background: var(--color-accent); }
}

.zone-label {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
}

.zone-value {
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
    color: var(--color-text);
}

// Progress stats
.exercise-select {
    background: var(--color-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-m);
    padding: var(--space-2) var(--space-3);
    font-size: var(--fs-sm);
    color: var(--color-text);
    cursor: pointer;

    &:focus {
        outline: 2px solid var(--color-accent);
        outline-offset: -2px;
    }
}

.progress-stats {
    display: flex;
    justify-content: space-around;
    padding-top: var(--space-3);
    border-top: 1px solid var(--color-border);
}

.progress-stat {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    
    .iconify {
        font-size: 28px;
        color: var(--color-accent);
    }
}

.stat-icon {
    font-size: 28px;
    color: var(--color-accent);
}

.stat-info {
    display: flex;
    flex-direction: column;
}

.stat-value {
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    color: var(--color-text);
}

.stat-label {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
}

// Microcycles
.microcycles-timeline {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: var(--space-3);
}

.cycle-block {
    background: var(--color-elevated);
    border: 2px solid var(--color-border);
    border-radius: var(--radius-l);
    padding: var(--space-3);
    
    &.cycle--light {
        border-color: var(--color-success);
        background: color-mix(in srgb, var(--color-success) 10%, var(--color-elevated));
    }

    &.cycle--moderate {
        border-color: var(--color-warning);
        background: color-mix(in srgb, var(--color-warning) 10%, var(--color-elevated));
    }

    &.cycle--heavy {
        border-color: var(--color-accent);
        background: color-mix(in srgb, var(--color-accent) 10%, var(--color-elevated));
    }

    &.cycle--deload {
        border-color: var(--color-text-muted);
        background: var(--color-elevated);
    }
}

.cycle-week {
    font-size: var(--fs-xs);
    color: var(--color-text-muted);
    margin-bottom: var(--space-1);
}

.cycle-type {
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    color: var(--color-text);
    margin-bottom: var(--space-2);
}

.cycle-adjustment {
    display: flex;
    align-items: center;
    gap: var(--space-1);
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
    color: var(--color-accent);
    margin-bottom: var(--space-3);
}

.cycle-metrics {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.cycle-metric {
    display: flex;
    justify-content: space-between;
    font-size: var(--fs-xs);
}

.metric-label {
    color: var(--color-text-muted);
}

.metric-value {
    color: var(--color-text);
    font-weight: var(--fw-medium);

    &.warning {
        color: var(--color-warning);
    }
}

// Fatigue indicator
.fatigue-indicator {
    padding: var(--space-3) 0;
}

.fatigue-gauge {
    position: relative;
    height: 32px;
    background: var(--color-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
    overflow: hidden;
    margin-bottom: var(--space-3);
}

.gauge-fill {
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    background: linear-gradient(90deg, 
        var(--color-success) 0%, 
        var(--color-warning) 50%, 
        var(--color-error) 100%);
    transition: width var(--dur-3) var(--ease-std);
}

.gauge-markers {
    position: absolute;
    top: 50%;
    left: 0;
    right: 0;
    transform: translateY(-50%);
    display: flex;
    justify-content: space-between;
}

.marker {
    font-size: var(--fs-xs);
    color: var(--color-surface);
    font-weight: var(--fw-semibold);
    padding: 0 var(--space-2);
    text-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);
}

.fatigue-status {
    text-align: center;
    font-size: var(--fs-md);
    font-weight: var(--fw-semibold);
    padding: var(--space-2);
    border-radius: var(--radius-m);
    margin-bottom: var(--space-3);

    &.status--fresh {
        background: color-mix(in srgb, var(--color-success) 15%, transparent);
        color: var(--color-success);
    }

    &.status--optimal {
        background: color-mix(in srgb, var(--color-warning) 15%, transparent);
        color: var(--color-warning);
    }

    &.status--fatigued {
        background: color-mix(in srgb, var(--color-error) 15%, transparent);
        color: var(--color-error);
    }
}

.recovery-metrics {
    display: flex;
    flex-direction: column;
    gap: var(--space-2);
}

.metric-row {
    display: flex;
    justify-content: space-between;
    padding: var(--space-2) 0;
    border-bottom: 1px solid var(--color-border);

    &:last-child {
        border-bottom: none;
    }
}

// Supplements
.supplements-timeline {
    padding: var(--space-3) 0;
}

.supplement-row {
    display: grid;
    grid-template-columns: 80px 1fr auto;
    align-items: center;
    gap: var(--space-3);
    margin-bottom: var(--space-3);
}

.supplement-name {
    font-size: var(--fs-sm);
    font-weight: var(--fw-medium);
    color: var(--color-text);
}

.supplement-periods {
    position: relative;
    height: 24px;
    background: var(--color-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-pill);
}

.period-bar {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    height: 16px;
    background: var(--color-accent);
    border-radius: var(--radius-pill);
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: all var(--dur-2) var(--ease-std);

    &:hover {
        background: var(--color-accent-hover);
        transform: translateY(-50%) scale(1.05);
    }
}

.period-dose {
    font-size: var(--fs-xxs);
    color: var(--color-accent-contrast);
    font-weight: var(--fw-semibold);
}

.supplement-effect {
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
    color: var(--color-text-muted);

    &.positive {
        color: var(--color-success);
    }
}

// Muscle tooltip
.muscle-tooltip {
    position: absolute;
    z-index: 9000;
    background: var(--color-surface);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-m);
    box-shadow: var(--shadow-xl);
    padding: var(--space-3);
    min-width: 200px;
    max-width: 300px;
    bottom: 100%;
    left: 50%;
    transform: translateX(-50%);
    margin-bottom: var(--space-1);
    animation: fadeIn 0.2s ease;
    cursor: pointer;
    
    // Стрелочка вниз
    &::after {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 6px solid transparent;
        border-top-color: var(--color-surface);
        z-index: 9001;
    }
    
    &::before {
        content: '';
        position: absolute;
        top: 100%;
        left: 50%;
        transform: translateX(-50%);
        border: 7px solid transparent;
        border-top-color: var(--color-border);
        margin-top: 1px;
    }
}

.tooltip-header {
    color: var(--color-text);
    font-size: var(--fs-sm);
    font-weight: var(--fw-semibold);
    margin-bottom: var(--space-2);
    border-bottom: 1px solid var(--color-border);
    padding-bottom: var(--space-1);
    z-index: 9001;
}

.tooltip-body {
    display: flex;
    flex-direction: column;
    gap: var(--space-1);
}

.tooltip-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: var(--fs-xs);
}

.tooltip-label {
    color: var(--color-text-muted);
    font-weight: var(--fw-medium);
}

.tooltip-value {
    color: var(--color-text);
    font-weight: var(--fw-semibold);
    
    &.total {
        color: var(--color-accent);
        font-weight: var(--fw-bold);
    }
}

.tooltip-exercises {
    margin-top: var(--space-2);
}

.exercise-list {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-1);
    margin-top: var(--space-1);
}

.exercise-tag {
    background: var(--color-elevated);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-s);
    padding: var(--space-1);
    font-size: var(--fs-xxs);
    color: var(--color-text-muted);
}

@keyframes fadeIn {
    from {
        opacity: 0;
        transform: translateX(-50%) translateY(-10px);
    }
    to {
        opacity: 1;
        transform: translateX(-50%) translateY(0);
    }
}
</style>