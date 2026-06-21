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

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Button, Empty, Spin } from '@douyinfe/semi-ui';
import { VChart } from '@visactor/react-vchart';
import {
  Activity,
  BarChart3,
  Building2,
  Coins,
  Gauge,
  RefreshCw,
  TrendingDown,
  TrendingUp,
  Trophy,
  UserRound,
  UsersRound,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, getLobeHubIcon, renderQuota } from '../../helpers';
import { useActualTheme } from '../../context/Theme';
import './index.css';

const PERIODS = ['today', 'week', 'month', 'year', 'all'];
const CHART_COLORS = [
  '#5267f7',
  '#67c5df',
  '#f59e0b',
  '#a78bfa',
  '#22c55e',
  '#ec8bdc',
  '#14b8a6',
  '#f97316',
  '#60a5fa',
  '#eab308',
  '#94a3b8',
];

const formatTokens = (value) => {
  const number = Number(value) || 0;
  const units = [
    [1e12, 'T'],
    [1e9, 'B'],
    [1e6, 'M'],
    [1e3, 'K'],
  ];
  const matched = units.find(([threshold]) => number >= threshold);
  if (!matched) {
    return Math.round(number).toLocaleString();
  }
  const [threshold, suffix] = matched;
  const scaled = number / threshold;
  return `${scaled.toFixed(scaled >= 100 ? 0 : scaled >= 10 ? 1 : 2)}${suffix}`;
};

const formatShare = (value) => `${((Number(value) || 0) * 100).toFixed(1)}%`;

const formatRate = (value) => {
  const number = Number(value) || 0;
  if (number >= 1000) {
    return formatTokens(number);
  }
  const maximumFractionDigits = number > 0 && number < 0.01 ? 6 : number < 1 ? 4 : 2;
  return number.toLocaleString(undefined, { maximumFractionDigits });
};

const periodLabels = (t) => ({
  today: t('\u4eca\u5929'),
  week: t('\u672c\u5468'),
  month: t('\u672c\u6708'),
  year: t('\u4eca\u5e74'),
  all: t('\u5168\u90e8\u65f6\u95f4'),
});

const Rankings = () => {
  const { t } = useTranslation();
  const actualTheme = useActualTheme();
  const [searchParams, setSearchParams] = useSearchParams();
  const view = searchParams.get('view') === 'users' ? 'users' : 'models';
  const requestedPeriod = searchParams.get('period');
  const period = PERIODS.includes(requestedPeriod) ? requestedPeriod : 'week';
  const [snapshot, setSnapshot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadRankings = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const response = await API.get(view === 'users' ? '/api/rankings/users' : '/api/rankings', {
        params: { period },
        signal,
      });
      if (!response.data?.success) {
        throw new Error(response.data?.message || t('\u52a0\u8f7d\u6392\u884c\u699c\u5931\u8d25'));
      }
      setSnapshot(response.data.data);
    } catch (requestError) {
      if (requestError?.code === 'ERR_CANCELED') {
        return;
      }
      setSnapshot(null);
      setError(requestError?.message || t('\u52a0\u8f7d\u6392\u884c\u699c\u5931\u8d25'));
    } finally {
      if (!signal?.aborted) {
        setLoading(false);
      }
    }
  }, [period, t, view]);

  useEffect(() => {
    const controller = new AbortController();
    loadRankings(controller.signal);
    return () => controller.abort();
  }, [loadRankings]);

  const handlePeriodChange = (nextPeriod) => {
    const params = {};
    if (view === 'users') {
      params.view = 'users';
    }
    if (nextPeriod !== 'week') {
      params.period = nextPeriod;
    }
    setSearchParams(params);
  };

  const handleViewChange = (nextView) => {
    const params = {};
    if (nextView === 'users') {
      params.view = 'users';
    }
    if (period !== 'week') {
      params.period = period;
    }
    setSearchParams(params);
  };

  const labels = periodLabels(t);

  return (
    <div className='rankings-page'>
      <main className='rankings-shell'>
        <header className='rankings-hero'>
          <p className='rankings-eyebrow'>{t('\u6392\u884c\u699c')}</p>
          <h1>{view === 'users' ? t('\u7528\u6237\u6392\u884c\u699c') : t('\u6a21\u578b\u8c03\u7528\u6392\u884c\u699c')}</h1>
          <p>
            {view === 'users'
              ? t('\u67e5\u770b\u6240\u9009\u5468\u671f\u5185\u7684\u7528\u6237\u8c03\u7528\u4e0e\u6d88\u8017\u6392\u884c\u3002')
              : t('\u53d1\u73b0\u7ad9\u70b9\u4e0a\u6700\u5e38\u7528\u7684\u6a21\u578b\u548c\u6b63\u5728\u589e\u957f\u7684\u4f9b\u5e94\u5546\uff0c\u6570\u636e\u57fa\u4e8e\u771f\u5b9e\u4f7f\u7528\u91cf\u5b9a\u65f6\u66f4\u65b0\u3002')}
          </p>
        </header>

        <div className='rankings-view-tabs' role='tablist' aria-label={t('\u6392\u884c\u699c\u7c7b\u578b')}>
          <button type='button' role='tab' aria-selected={view === 'models'} onClick={() => handleViewChange('models')}>
            {t('\u6a21\u578b\u6392\u884c\u699c')}
          </button>
          <button type='button' role='tab' aria-selected={view === 'users'} onClick={() => handleViewChange('users')}>
            {t('\u7528\u6237\u6392\u884c\u699c')}
          </button>
        </div>

        <div className='rankings-periods' role='tablist' aria-label={t('\u7edf\u8ba1\u5468\u671f')}>
          {PERIODS.map((item) => (
            <button
              key={item}
              type='button'
              role='tab'
              aria-selected={period === item}
              className={period === item ? 'rankings-period-active' : ''}
              onClick={() => handlePeriodChange(item)}
            >
              {labels[item]}
            </button>
          ))}
        </div>

        {loading ? (
          <RankingsLoading t={t} />
        ) : error ? (
          <RankingsError message={error} onRetry={() => loadRankings()} t={t} />
        ) : (
          view === 'users'
            ? <UserRankingsContent snapshot={snapshot} period={period} t={t} />
            : <RankingsContent snapshot={snapshot} period={period} actualTheme={actualTheme} t={t} />
        )}
      </main>
    </div>
  );
};

const UserRankingsContent = ({ snapshot, period, t }) => {
  const summary = snapshot?.summary || {};
  const periodLabel = periodLabels(t)[period];
  const showLifetime = period !== 'all';
  const cards = [
    {
      label: `${periodLabel} · ${t('\u603b\u8bf7\u6c42\u6570')}`,
      value: formatTokens(summary.requests ?? summary.requests_24h),
      lifetime: showLifetime ? formatTokens(summary.requests_all_time) : undefined,
      icon: <Activity size={19} />,
    },
    {
      label: `${periodLabel} · ${t('\u603b\u989d\u5ea6')}`,
      value: renderQuota(summary.quota ?? summary.quota_24h ?? 0),
      lifetime: showLifetime ? renderQuota(summary.quota_all_time || 0) : undefined,
      icon: <Coins size={19} />,
    },
    {
      label: `${periodLabel} · ${t('\u603b Tokens')}`,
      value: formatTokens(summary.tokens ?? summary.tokens_24h),
      lifetime: showLifetime ? formatTokens(summary.tokens_all_time) : undefined,
      icon: <Gauge size={19} />,
    },
    {
      label: `${periodLabel} · ${t('\u5e73\u5747 RPM')}`,
      value: formatRate(summary.average_rpm),
      icon: <BarChart3 size={19} />,
    },
    {
      label: `${periodLabel} · ${t('\u5e73\u5747 TPM')}`,
      value: formatRate(summary.average_tpm),
      icon: <UsersRound size={19} />,
    },
  ];
  const rankings = [
    {
      title: t('\u7528\u6237\u8c03\u7528\u6b21\u6570\u6392\u884c'),
      description: t('\u6309\u6240\u9009\u5468\u671f\u8bf7\u6c42\u6570\u6392\u5e8f'),
      rows: snapshot?.request_rankings || [],
      formatter: formatTokens,
    },
    {
      title: t('\u7528\u6237\u989d\u5ea6\u6392\u884c'),
      description: t('\u6309\u6240\u9009\u5468\u671f\u989d\u5ea6\u6d88\u8017\u6392\u5e8f'),
      rows: snapshot?.quota_rankings || [],
      formatter: (value) => renderQuota(value),
    },
    {
      title: t('\u7528\u6237 Token \u6d88\u8017\u6392\u884c'),
      description: t('\u6309\u6240\u9009\u5468\u671f Token \u6d88\u8017\u6392\u5e8f'),
      rows: snapshot?.token_rankings || [],
      formatter: formatTokens,
    },
  ];

  return (
    <div className='rankings-user-content'>
      <section className='rankings-summary-grid' aria-label={t('\u7528\u6237\u8c03\u7528\u6982\u89c8')}>
        {cards.map((card) => (
          <article key={card.label} className='rankings-card rankings-summary-card'>
            <div className='rankings-summary-icon'>{card.icon}</div>
            <div>
              <span>{card.label}</span>
              <strong>{card.value}</strong>
              {card.lifetime !== undefined && (
                <small>{t('\u5e73\u53f0\u7d2f\u8ba1')} <b>{card.lifetime}</b></small>
              )}
            </div>
          </article>
        ))}
      </section>

      <section className='rankings-user-leaderboards'>
        {rankings.map((ranking) => (
          <UserLeaderboard key={ranking.title} {...ranking} t={t} />
        ))}
      </section>
    </div>
  );
};

const UserLeaderboard = ({ title, description, rows, formatter, t }) => (
  <article className='rankings-card rankings-user-board'>
    <header>
      <h2><UserRound size={18} />{title}</h2>
      <p>{description}</p>
    </header>
    {rows.length ? (
      <ol>
        {rows.map((row) => (
          <li key={row.user_id}>
            <span className='rankings-rank'>{row.rank}.</span>
            <span className='rankings-user-icon'><UserRound size={16} /></span>
            <div className='rankings-user-name'>
              <strong title={row.username}>{row.username || t('\u672a\u77e5\u7528\u6237')}</strong>
              <span>ID: {row.user_id}</span>
            </div>
            <div className='rankings-entity-value'>
              <strong>{formatter(row.value)}</strong>
              <span>{formatShare(row.share)}</span>
            </div>
          </li>
        ))}
      </ol>
    ) : (
      <p className='rankings-list-empty'>{t('\u6682\u65e0\u6392\u884c\u6570\u636e')}</p>
    )}
  </article>
);

const RankingsContent = ({ snapshot, period, actualTheme, t }) => {
  const models = snapshot?.models || [];
  const vendors = snapshot?.vendors || [];
  const movers = snapshot?.top_movers || [];
  const droppers = snapshot?.top_droppers || [];
  const history = snapshot?.models_history || { points: [], models: [] };
  const totalTokens = models.reduce((sum, item) => sum + Number(item.total_tokens || 0), 0);
  const chartSpec = useModelChartSpec(history, actualTheme);

  if (!models.length) {
    return (
      <section className='rankings-card rankings-empty-card'>
        <Empty
          title={t('\u6682\u65e0\u6392\u884c\u6570\u636e')}
          description={t('\u5f53\u524d\u5468\u671f\u8fd8\u6ca1\u6709\u53ef\u7edf\u8ba1\u7684\u6a21\u578b\u8c03\u7528')}
        />
      </section>
    );
  }

  return (
    <div className='rankings-content'>
      <section className='rankings-card rankings-model-card'>
        <div className='rankings-card-heading'>
          <div>
            <h2><BarChart3 size={18} />{t('\u70ed\u95e8\u6a21\u578b')}</h2>
            <p>{t('\u6240\u9009\u5468\u671f\u5185\u5404\u6a21\u578b\u7684 Token \u7528\u91cf')}</p>
          </div>
          <div className='rankings-total'>
            <strong>{formatTokens(totalTokens)}</strong>
            <span>{t('\u603b\u7528\u91cf')}</span>
          </div>
        </div>

        {chartSpec ? (
          <div className='rankings-chart' aria-label={t('\u6a21\u578b Token \u7528\u91cf\u56fe\u8868')}>
            <VChart key={`${period}-${actualTheme}`} spec={chartSpec} />
          </div>
        ) : (
          <div className='rankings-chart-empty'>{t('\u6682\u65e0\u5386\u53f2\u8d8b\u52bf\u6570\u636e')}</div>
        )}

        <div className='rankings-divider' />
        <div className='rankings-leaderboard-heading'>
          <h2><Trophy size={18} />{t('LLM \u6392\u884c\u699c')}</h2>
          <p>{t('\u5bf9\u6bd4\u7ad9\u70b9\u4e0a\u6700\u53d7\u6b22\u8fce\u7684\u6a21\u578b')}</p>
        </div>
        <ModelLeaderboard rows={models} t={t} />
      </section>

      <section className='rankings-lower-grid'>
        <div className='rankings-card rankings-vendor-card'>
          <div className='rankings-card-heading rankings-card-heading-compact'>
            <div>
              <h2><Building2 size={18} />{t('\u4f9b\u5e94\u5546\u6392\u884c')}</h2>
              <p>{t('\u6309 Token \u7528\u91cf\u7edf\u8ba1\u4f9b\u5e94\u5546\u4efd\u989d')}</p>
            </div>
          </div>
          <VendorLeaderboard rows={vendors} t={t} />
        </div>

        <div className='rankings-trend-grid'>
          <TrendCard
            title={t('\u4e0a\u5347\u6700\u5feb')}
            icon={<TrendingUp size={18} />}
            rows={movers}
            tone='up'
            t={t}
          />
          <TrendCard
            title={t('\u4e0b\u964d\u6700\u5feb')}
            icon={<TrendingDown size={18} />}
            rows={droppers}
            tone='down'
            t={t}
          />
        </div>
      </section>
    </div>
  );
};

const useModelChartSpec = (history, actualTheme) => useMemo(() => {
  const points = Array.isArray(history?.points) ? history.points : [];
  if (!points.length) {
    return null;
  }
  const textColor = actualTheme === 'dark' ? 'rgba(236,255,242,0.68)' : 'rgba(6,36,22,0.62)';
  const gridColor = actualTheme === 'dark' ? 'rgba(74,222,128,0.12)' : 'rgba(0,109,48,0.10)';
  return {
    type: 'bar',
    data: [{ id: 'rankings-model-history', values: points }],
    xField: 'label',
    yField: 'tokens',
    seriesField: 'model',
    stack: true,
    color: CHART_COLORS,
    padding: { top: 12, right: 12, bottom: 8, left: 8 },
    legends: { visible: false },
    bar: { style: { cornerRadius: 2 } },
    axes: [
      {
        orient: 'bottom',
        label: { style: { fill: textColor, fontSize: 11 }, autoHide: true },
        tick: { visible: false },
        domainLine: { style: { stroke: gridColor } },
      },
      {
        orient: 'left',
        label: {
          formatMethod: (value) => formatTokens(Number(value)),
          style: { fill: textColor, fontSize: 11 },
        },
        tick: { visible: false },
        domainLine: { visible: false },
        grid: { visible: true, style: { lineDash: [3, 3], stroke: gridColor } },
      },
    ],
    tooltip: {
      dimension: {
        title: { value: (datum) => datum?.label || '' },
        content: [{ key: (datum) => datum?.model || '', value: (datum) => formatTokens(datum?.tokens) }],
      },
    },
    animation: true,
  };
}, [history, actualTheme]);

const ModelLeaderboard = ({ rows, t }) => {
  const midpoint = Math.ceil(rows.length / 2);
  const columns = [rows.slice(0, midpoint), rows.slice(midpoint)].filter((items) => items.length);
  return (
    <div className='rankings-model-columns'>
      {columns.map((items, columnIndex) => (
        <ol key={columnIndex} className='rankings-model-list'>
          {items.map((row) => (
            <li key={row.model_name}>
              <span className='rankings-rank'>{row.rank}.</span>
              <span className='rankings-entity-icon'>{getLobeHubIcon(row.vendor_icon, 22)}</span>
              <div className='rankings-entity-main'>
                <strong title={row.model_name}>{row.model_name}</strong>
                <span>{row.vendor || t('\u672a\u77e5\u4f9b\u5e94\u5546')}</span>
              </div>
              <div className='rankings-entity-value'>
                <strong>{formatTokens(row.total_tokens)}</strong>
                <span>{formatShare(row.share)}</span>
              </div>
            </li>
          ))}
        </ol>
      ))}
    </div>
  );
};

const VendorLeaderboard = ({ rows, t }) => (
  <ol className='rankings-vendor-list'>
    {rows.length ? rows.map((row) => (
      <li key={row.vendor}>
        <span className='rankings-rank'>{row.rank}.</span>
        <span className='rankings-entity-icon'>{getLobeHubIcon(row.vendor_icon, 22)}</span>
        <div className='rankings-vendor-main'>
          <div><strong>{row.vendor}</strong><span>{row.models_count} {t('\u4e2a\u6a21\u578b')}</span></div>
          <div className='rankings-share-track'><span style={{ width: `${Math.max(2, row.share * 100)}%` }} /></div>
        </div>
        <div className='rankings-entity-value'>
          <strong>{formatTokens(row.total_tokens)}</strong>
          <span>{formatShare(row.share)}</span>
        </div>
      </li>
    )) : <li className='rankings-list-empty'>{t('\u6682\u65e0\u6392\u884c\u6570\u636e')}</li>}
  </ol>
);

const TrendCard = ({ title, icon, rows, tone, t }) => (
  <article className={`rankings-card rankings-trend-card rankings-trend-${tone}`}>
    <h2>{icon}{title}</h2>
    {rows.length ? (
      <ul>
        {rows.map((row) => (
          <li key={row.model_name}>
            <span className='rankings-entity-icon'>{getLobeHubIcon(row.vendor_icon, 20)}</span>
            <div><strong title={row.model_name}>{row.model_name}</strong><span>{row.vendor}</span></div>
            <b>{row.rank_delta > 0 ? '+' : ''}{row.rank_delta}</b>
          </li>
        ))}
      </ul>
    ) : (
      <p className='rankings-list-empty'>{t('\u6682\u65e0\u6392\u540d\u53d8\u5316')}</p>
    )}
  </article>
);

const RankingsLoading = ({ t }) => (
  <div className='rankings-card rankings-loading' role='status'>
    <Spin size='large' />
    <span>{t('\u6b63\u5728\u52a0\u8f7d\u6392\u884c\u699c')}</span>
  </div>
);

const RankingsError = ({ message, onRetry, t }) => (
  <div className='rankings-card rankings-error' role='alert'>
    <h2>{t('\u52a0\u8f7d\u6392\u884c\u699c\u5931\u8d25')}</h2>
    <p>{message}</p>
    <Button icon={<RefreshCw size={16} />} onClick={onRetry}>{t('\u91cd\u8bd5')}</Button>
  </div>
);

export default Rankings;
