<script setup>
import { computed, ref, watch } from "vue";
import { calendarDays, summarizeDays, dayKey } from "../lib/poems";
const props = defineProps({
  counts: { type: Object, default: () => ({}) },
  year: Number,
  loading: Boolean,
  error: String,
  selectedDay: String,
});
const emit = defineEmits(["year", "day", "retry"]);
const currentYear = Number(dayKey(new Date()).slice(0, 4));
const years = Array.from(
  { length: currentYear - 2020 + 1 },
  (_, i) => currentYear - i,
);
const cells = computed(() => calendarDays(props.year, props.counts));
const stats = computed(() => summarizeDays(props.counts));
const hovered = ref(null);
const weeks = computed(() =>
  Array.from({ length: cells.value.length / 7 }, (_, i) =>
    cells.value.slice(i * 7, i * 7 + 7),
  ),
);
const month = ref(
  props.year === currentYear ? Number(dayKey(new Date()).slice(5, 7)) : 1,
);
watch(
  () => props.year,
  () => {
    month.value =
      props.year === currentYear ? Number(dayKey(new Date()).slice(5, 7)) : 1;
    hovered.value = null;
  },
);
const monthCells = computed(() => {
  const start = new Date(Date.UTC(props.year, month.value - 1, 1));
  const offset = (start.getUTCDay() + 6) % 7;
  const count = new Date(Date.UTC(props.year, month.value, 0)).getUTCDate();
  return Array.from({ length: Math.ceil((offset + count) / 7) * 7 }, (_, i) => {
    if (i < offset || i >= offset + count) return null;
    const key = `${props.year}-${String(month.value).padStart(2, "0")}-${String(i - offset + 1).padStart(2, "0")}`;
    return cells.value.find((c) => c.key === key);
  });
});
const activeKey = ref("");
const tabKey = computed(
  () =>
    activeKey.value ||
    cells.value.find((d) => !d.outside && !d.future && d.count > 0)?.key ||
    cells.value.find((d) => !d.outside)?.key,
);
function moveFocus(event, day) {
  const delta = { ArrowUp: -1, ArrowDown: 1, ArrowLeft: -7, ArrowRight: 7 }[
    event.key
  ];
  if (!delta) return;
  event.preventDefault();
  const next =
    cells.value[cells.value.findIndex((d) => d.key === day.key) + delta];
  if (!next || next.outside || next.future) return;
  activeKey.value = next.key;
  event.currentTarget
    .closest(".heatmap-weeks")
    .querySelector(`[data-day="${next.key}"]`)
    ?.focus();
}
</script>

<template>
  <section class="activity-section" aria-labelledby="activity-title">
    <header class="section-heading">
      <div>
        <span class="eyebrow">A LITTLE, EVERY DAY</span>
        <h2 id="activity-title">写过的日子，都算数。</h2>
      </div>
      <label class="year-control"
        ><span class="sr-only">创作记录年份</span
        ><select
          :value="year"
          @change="emit('year', Number($event.target.value))"
        >
          <option v-for="y in years" :key="y" :value="y">{{ y }}</option>
        </select></label
      >
    </header>
    <div v-if="error" class="inline-error" role="alert">
      {{ error }} <button class="text-link" @click="emit('retry')">重试</button>
    </div>
    <div v-else class="calendar-body" :aria-busy="loading">
      <div class="calendar-summary">
        <p>
          <strong>{{ loading ? "—" : stats.total }}</strong> 首原创诗歌
          <span class="summary-dot">·</span>
          <strong>{{ loading ? "—" : stats.days }}</strong> 个创作日
        </p>
        <span>{{ year }} 年的文字足迹</span>
      </div>
      <div class="heatmap-overflow desktop-calendar">
        <div class="heatmap-layout">
          <div class="weekday-labels">
            <span>一</span><span>三</span><span>五</span><span>日</span>
          </div>
          <div class="heatmap-weeks">
            <div v-for="(week, wi) in weeks" :key="wi" class="heatmap-week">
              <span class="month-label">{{
                week.find((d) => d.month && d.key.endsWith("01"))?.month
                  ? `${week.find((d) => d.month && d.key.endsWith("01")).month}月`
                  : ""
              }}</span
              ><template v-for="day in week" :key="day.key"
                ><span v-if="day.outside" class="heat-cell outside"></span
                ><button
                  v-else
                  class="heat-cell"
                  :class="[
                    `level-${day.level}`,
                    { future: day.future, chosen: selectedDay === day.key },
                  ]"
                  :data-day="day.key"
                  :tabindex="day.key === tabKey ? 0 : -1"
                  @keydown="moveFocus($event, day)"
                  :disabled="day.future || loading"
                  :aria-label="`${day.key}，${day.count} 首原创诗歌`"
                  :aria-pressed="selectedDay === day.key"
                  :title="`${day.key} · ${day.count} 首原创诗歌`"
                  @mouseenter="hovered = day"
                  @mouseleave="hovered = null"
                  @focus="hovered = day"
                  @blur="hovered = null"
                  @click="emit('day', selectedDay === day.key ? '' : day.key)"
                ></button
              ></template>
            </div>
          </div>
        </div>
      </div>
      <div class="mobile-calendar">
        <div class="month-navigation">
          <button
            aria-label="上一个月"
            :disabled="month === 1"
            @click="month--"
          >
            ←</button
          ><span>{{ year }} 年 {{ month }} 月</span
          ><button
            aria-label="下一个月"
            :disabled="month === 12"
            @click="month++"
          >
            →
          </button>
        </div>
        <div class="month-grid">
          <span
            v-for="label in ['一', '二', '三', '四', '五', '六', '日']"
            :key="label"
            class="month-weekday"
            >{{ label }}</span
          ><template v-for="(day, i) in monthCells" :key="i"
            ><button
              v-if="day"
              :class="[
                `level-${day.level}`,
                { 'month-today': day.key === dayKey(new Date()) },
              ]"
              :disabled="day.future || loading"
              :aria-label="`${day.key}，${day.count} 首原创诗歌`"
              @click="emit('day', day.key)"
            >
              <span>{{ Number(day.key.slice(8)) }}</span
              ><i v-if="day.count"></i></button
            ><span v-else></span
          ></template>
        </div>
      </div>
      <footer class="calendar-footer">
        <span aria-live="polite">{{
          hovered
            ? `${hovered.key.replaceAll("-", ".")} · ${hovered.count} 首原创诗歌`
            : loading
              ? "正在整理创作记录…"
              : stats.days
                ? `最长连续创作 ${stats.longest} 天 · 点击方格，重读那一天`
                : "这一年还没有公开的原创诗歌，下一行随时可以开始。"
        }}</span>
        <div class="heat-legend">
          <span>少</span
          ><i v-for="i in 5" :key="i" :class="`level-${i - 1}`"></i
          ><span>多</span>
        </div>
      </footer>
    </div>
    <p class="calendar-note">
      按北京时间记录已公开的原创诗歌；一篇组诗计作一次发布。
    </p>
  </section>
</template>
