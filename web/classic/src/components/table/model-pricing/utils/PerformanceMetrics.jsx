/*
Copyright (C) 2025 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/

import React from 'react';

export const MODEL_PERFORMANCE_HOURS = 24;

const isFiniteNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number);
};

const toFiniteNumber = (value, fallback = 0) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
};

export const buildModelPerformanceMap = (summary) => {
  const models = Array.isArray(summary?.models) ? summary.models : [];
  return models.reduce((map, item) => {
    if (item?.model_name) {
      map[item.model_name] = item;
    }
    return map;
  }, {});
};

export const formatLatencyMs = (value) => {
  if (!isFiniteNumber(value)) {
    return '-';
  }

  const latencyMs = Math.max(0, Number(value));
  if (latencyMs >= 1000) {
    const seconds = latencyMs / 1000;
    return `${seconds.toFixed(seconds >= 10 ? 1 : 2)}s`;
  }

  return `${Math.round(latencyMs)}ms`;
};

export const formatPositiveLatencyMs = (value) => {
  if (!isFiniteNumber(value) || Number(value) <= 0) {
    return '-';
  }

  return formatLatencyMs(value);
};

export const formatTps = (value) => {
  if (!isFiniteNumber(value)) {
    return '-';
  }

  const tps = Math.max(0, Number(value));
  if (tps >= 1000) {
    return `${(tps / 1000).toFixed(tps >= 10000 ? 1 : 2)}k`;
  }
  if (tps >= 100) {
    return tps.toFixed(0);
  }
  if (tps >= 10) {
    return tps.toFixed(1);
  }
  return tps.toFixed(2);
};

export const formatSuccessRate = (value) => {
  if (!isFiniteNumber(value)) {
    return '-';
  }

  const rate = Math.min(100, Math.max(0, toFiniteNumber(value)));
  if (rate === 0 || rate === 100) {
    return `${rate.toFixed(0)}%`;
  }
  return `${rate.toFixed(1)}%`;
};

const toneColorMap = {
  good: 'var(--semi-color-success)',
  normal: 'var(--semi-color-warning)',
  bad: 'var(--semi-color-danger)',
};

const getLatencyTone = (value) => {
  if (!isFiniteNumber(value) || Number(value) <= 0) {
    return 'normal';
  }

  const latencyMs = Math.max(0, Number(value));
  if (latencyMs <= 1000) {
    return 'good';
  }
  if (latencyMs <= 3000) {
    return 'normal';
  }
  return 'bad';
};

const getTpsTone = (value) => {
  if (!isFiniteNumber(value)) {
    return 'normal';
  }

  const tps = Math.max(0, Number(value));
  if (tps >= 30) {
    return 'good';
  }
  if (tps >= 10) {
    return 'normal';
  }
  return 'bad';
};

const getSuccessRateTone = (value) => {
  if (!isFiniteNumber(value)) {
    return 'normal';
  }

  const rate = Math.min(100, Math.max(0, toFiniteNumber(value)));
  if (rate >= 99) {
    return 'good';
  }
  if (rate >= 95) {
    return 'normal';
  }
  return 'bad';
};

const getMetricItems = (metrics, t) => [
  {
    key: 'ttft',
    label: t('\u9996 Token'),
    value: formatPositiveLatencyMs(metrics?.avg_ttft_ms),
    tone: getLatencyTone(metrics?.avg_ttft_ms),
  },
  {
    key: 'tps',
    label: 'TPS',
    value: formatTps(metrics?.avg_tps),
    tone: getTpsTone(metrics?.avg_tps),
  },
  {
    key: 'success',
    label: t('\u6210\u529f\u7387'),
    value: formatSuccessRate(metrics?.success_rate),
    tone: getSuccessRateTone(metrics?.success_rate),
  },
];

const metricTextStyle = {
  color: 'var(--semi-color-text-2)',
};

const getMetricValueStyle = (tone) => ({
  color: toneColorMap[tone] || 'var(--semi-color-text-0)',
});

export const ModelPerformanceMetrics = ({ metrics, t, variant = 'table' }) => {
  if (!metrics) {
    if (variant === 'card') {
      return (
        <div
          className='flex items-center text-xs'
          style={{ ...metricTextStyle, minHeight: 18 }}
        >
          {t('\u6682\u65e0\u6570\u636e')}
        </div>
      );
    }

    return (
      <span className='text-xs' style={metricTextStyle}>
        {t('\u6682\u65e0\u6570\u636e')}
      </span>
    );
  }

  const items = getMetricItems(metrics, t);

  if (variant === 'card') {
    return (
      <div className='grid grid-cols-3 gap-2 text-xs' style={{ minHeight: 18 }}>
        {items.map((item) => (
          <div key={item.key} className='min-w-0 flex items-center gap-1'>
            <span className='truncate' style={metricTextStyle}>
              {item.label}
            </span>
            <span
              className='font-semibold truncate'
              style={getMetricValueStyle(item.tone)}
            >
              {item.value}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className='flex flex-col gap-1 text-xs min-w-[132px]'>
      {items.map((item) => (
        <div key={item.key} className='flex items-center justify-between gap-3'>
          <span style={metricTextStyle}>{item.label}</span>
          <span className='font-medium' style={getMetricValueStyle(item.tone)}>
            {item.value}
          </span>
        </div>
      ))}
    </div>
  );
};
