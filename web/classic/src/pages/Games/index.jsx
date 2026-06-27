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

import React, {
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Button, Empty, Spin } from '@douyinfe/semi-ui';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Gift,
  Medal,
  PanelLeftClose,
  PanelLeftOpen,
  Pause,
  Play,
  RefreshCw,
  RotateCw,
  Trophy,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { API, renderQuota, showError, showSuccess } from '../../helpers';
import { UserContext } from '../../context/User';
import './index.css';

const COLS = 10;
const ROWS = 20;
const CELL = 40;
const LINE_SCORES = [0, 100, 300, 500, 800];
const PIECES = [
  { name: 'I', color: '#22c55e', matrix: [[1, 1, 1, 1]] },
  {
    name: 'O',
    color: '#eab308',
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  {
    name: 'T',
    color: '#a855f7',
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
    ],
  },
  {
    name: 'S',
    color: '#14b8a6',
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
    ],
  },
  {
    name: 'Z',
    color: '#ef4444',
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
    ],
  },
  {
    name: 'J',
    color: '#3b82f6',
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
    ],
  },
  {
    name: 'L',
    color: '#f97316',
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
    ],
  },
];

const emptyBoard = () =>
  Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => null));

const cloneMatrix = (matrix) => matrix.map((row) => [...row]);

const randomPiece = () => {
  const piece = PIECES[Math.floor(Math.random() * PIECES.length)];
  return {
    name: piece.name,
    color: piece.color,
    matrix: cloneMatrix(piece.matrix),
  };
};

const rotateMatrix = (matrix) =>
  matrix[0].map((_, index) => matrix.map((row) => row[index]).reverse());

const collides = (board, piece, offsetX, offsetY) => {
  for (let y = 0; y < piece.matrix.length; y++) {
    for (let x = 0; x < piece.matrix[y].length; x++) {
      if (!piece.matrix[y][x]) continue;
      const nextX = offsetX + x;
      const nextY = offsetY + y;
      if (nextX < 0 || nextX >= COLS || nextY >= ROWS) return true;
      if (nextY >= 0 && board[nextY][nextX]) return true;
    }
  }
  return false;
};

const mergePiece = (board, piece, offsetX, offsetY) => {
  piece.matrix.forEach((row, y) => {
    row.forEach((value, x) => {
      if (!value) return;
      const boardY = offsetY + y;
      if (boardY >= 0) {
        board[boardY][offsetX + x] = piece.color;
      }
    });
  });
};

const clearLines = (state) => {
  const remainingRows = state.board.filter((row) => row.some((cell) => !cell));
  const cleared = ROWS - remainingRows.length;
  if (!cleared) return;
  while (remainingRows.length < ROWS) {
    remainingRows.unshift(Array.from({ length: COLS }, () => null));
  }
  state.board = remainingRows;
  state.lines += cleared;
  state.level = Math.floor(state.lines / 10);
  state.score += LINE_SCORES[cleared] * (state.level + 1);
};

const spawnPiece = (state) => {
  state.piece = state.nextPiece || randomPiece();
  state.nextPiece = randomPiece();
  state.x = Math.floor((COLS - state.piece.matrix[0].length) / 2);
  state.y = 0;
  if (collides(state.board, state.piece, state.x, state.y)) {
    state.running = false;
    state.over = true;
  }
};

const createGameState = () => {
  const state = {
    board: emptyBoard(),
    piece: null,
    nextPiece: randomPiece(),
    x: 0,
    y: 0,
    score: 0,
    lines: 0,
    level: 0,
    running: true,
    paused: false,
    over: false,
    startedAt: Date.now(),
    lastDropAt: Date.now(),
  };
  spawnPiece(state);
  return state;
};

const getDropInterval = (state) => Math.max(140, 720 - state.level * 55);

const lockPiece = (state) => {
  mergePiece(state.board, state.piece, state.x, state.y);
  clearLines(state);
  spawnPiece(state);
};

const moveDown = (state) => {
  if (!state?.running || state.paused || state.over) return;
  if (!collides(state.board, state.piece, state.x, state.y + 1)) {
    state.y += 1;
    return;
  }
  lockPiece(state);
};

const moveHorizontal = (state, direction) => {
  if (!state?.running || state.paused || state.over) return;
  const nextX = state.x + direction;
  if (!collides(state.board, state.piece, nextX, state.y)) {
    state.x = nextX;
  }
};

const rotatePiece = (state) => {
  if (!state?.running || state.paused || state.over) return;
  const rotated = {
    ...state.piece,
    matrix: rotateMatrix(state.piece.matrix),
  };
  for (const kick of [0, -1, 1, -2, 2]) {
    if (!collides(state.board, rotated, state.x + kick, state.y)) {
      state.piece = rotated;
      state.x += kick;
      return;
    }
  }
};

const hardDrop = (state) => {
  if (!state?.running || state.paused || state.over) return;
  let dropped = 0;
  while (!collides(state.board, state.piece, state.x, state.y + 1)) {
    state.y += 1;
    dropped += 1;
  }
  state.score += dropped * 2;
  lockPiece(state);
};

const toSnapshot = (state) => ({
  score: state?.score || 0,
  lines: state?.lines || 0,
  level: state?.level || 0,
  running: Boolean(state?.running),
  paused: Boolean(state?.paused),
  over: Boolean(state?.over),
  nextPiece: state?.nextPiece?.name || '',
  startedAt: state?.startedAt || 0,
});

const drawCell = (ctx, x, y, color) => {
  const px = x * CELL;
  const py = y * CELL;
  ctx.fillStyle = color;
  ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.16)';
  ctx.strokeRect(px + 1.5, py + 1.5, CELL - 3, CELL - 3);
};

const drawGame = (canvas, state) => {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = 'rgba(15, 23, 42, 0.08)';
  for (let x = 0; x <= COLS; x++) {
    ctx.beginPath();
    ctx.moveTo(x * CELL, 0);
    ctx.lineTo(x * CELL, ROWS * CELL);
    ctx.stroke();
  }
  for (let y = 0; y <= ROWS; y++) {
    ctx.beginPath();
    ctx.moveTo(0, y * CELL);
    ctx.lineTo(COLS * CELL, y * CELL);
    ctx.stroke();
  }
  if (!state) return;
  state.board.forEach((row, y) => {
    row.forEach((color, x) => {
      if (color) drawCell(ctx, x, y, color);
    });
  });
  if (state.piece && !state.over) {
    state.piece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value) drawCell(ctx, state.x + x, state.y + y, state.piece.color);
      });
    });
  }
};

const formatScore = (score) => Number(score || 0).toLocaleString();

const Games = () => {
  const { t } = useTranslation();
  const [userState, userDispatch] = useContext(UserContext);
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const loopRef = useRef(null);
  const sessionTokenRef = useRef('');
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [claiming, setClaiming] = useState(false);
  const [gameInfo, setGameInfo] = useState(null);
  const [snapshot, setSnapshot] = useState(toSnapshot(null));
  const [activeView, setActiveView] = useState('tetris');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(
    () => localStorage.getItem('games_sidebar_collapsed') === 'true',
  );
  const tetris = useMemo(
    () => gameInfo?.games?.find((game) => game.key === 'tetris'),
    [gameInfo],
  );
  const scoreRewardPreview = Math.floor(
    snapshot.score / Math.max(Number(tetris?.score_per_quota || 1), 1),
  );
  const rewardPreview = Math.min(
    scoreRewardPreview,
    Number(gameInfo?.daily_remaining || 0),
  );
  const tetrisStats = gameInfo?.tetris_stats || {};
  const tetrisBestRecord = tetrisStats.best_record || {};
  const tetrisLeaderboard = tetrisStats.leaderboard || [];
  const hasTetrisBestRecord = Number(tetrisBestRecord.score || 0) > 0;

  useEffect(() => {
    localStorage.setItem(
      'games_sidebar_collapsed',
      sidebarCollapsed ? 'true' : 'false',
    );
  }, [sidebarCollapsed]);

  const refreshGameInfo = useCallback(async () => {
    const res = await API.get('/api/games');
    if (!res.data?.success) {
      throw new Error(res.data?.message || t('加载小游戏失败'));
    }
    setGameInfo(res.data.data);
  }, [t]);

  const updateView = useCallback(() => {
    drawGame(canvasRef.current, gameRef.current);
    setSnapshot(toSnapshot(gameRef.current));
  }, []);

  const stopLoop = useCallback(() => {
    if (loopRef.current) {
      clearInterval(loopRef.current);
      loopRef.current = null;
    }
  }, []);

  const startLoop = useCallback(() => {
    stopLoop();
    loopRef.current = setInterval(() => {
      const state = gameRef.current;
      if (!state?.running || state.paused || state.over) {
        updateView();
        return;
      }
      const now = Date.now();
      if (now - state.lastDropAt >= getDropInterval(state)) {
        moveDown(state);
        state.lastDropAt = now;
        updateView();
      }
    }, 60);
  }, [stopLoop, updateView]);

  const startGame = useCallback(async () => {
    setStarting(true);
    try {
      const res = await API.post('/api/games/tetris/start');
      if (!res.data?.success) {
        throw new Error(res.data?.message || t('开始游戏失败'));
      }
      sessionTokenRef.current = res.data.data.session_token;
      gameRef.current = createGameState();
      updateView();
      startLoop();
    } catch (error) {
      showError(error.message || t('开始游戏失败'));
    } finally {
      setStarting(false);
    }
  }, [startLoop, t, updateView]);

  const togglePause = useCallback(() => {
    const state = gameRef.current;
    if (!state?.running || state.over) return;
    state.paused = !state.paused;
    state.lastDropAt = Date.now();
    updateView();
  }, [updateView]);

  const applyAction = useCallback(
    (action) => {
      const state = gameRef.current;
      if (!state?.running || state.over) return;
      if (action === 'left') moveHorizontal(state, -1);
      if (action === 'right') moveHorizontal(state, 1);
      if (action === 'down') {
        moveDown(state);
        state.score += 1;
      }
      if (action === 'rotate') rotatePiece(state);
      if (action === 'drop') hardDrop(state);
      updateView();
    },
    [updateView],
  );

  const claimReward = useCallback(async () => {
    const state = gameRef.current;
    if (!state?.over || !sessionTokenRef.current) return;
    setClaiming(true);
    try {
      const res = await API.post('/api/games/tetris/claim', {
        session_token: sessionTokenRef.current,
        score: state.score,
        duration_seconds: Math.max(
          0,
          Math.floor((Date.now() - state.startedAt) / 1000),
        ),
      });
      if (!res.data?.success) {
        throw new Error(res.data?.message || t('领取失败'));
      }
      const data = res.data.data;
      sessionTokenRef.current = '';
      if (userState?.user && Number.isFinite(Number(data.user_quota))) {
        const nextUser = {
          ...userState.user,
          quota: data.user_quota,
        };
        userDispatch({ type: 'login', payload: nextUser });
        localStorage.setItem('user', JSON.stringify(nextUser));
      }
      showSuccess(t('领取成功') + ` ${renderQuota(data.quota_awarded)}`);
      await refreshGameInfo();
      updateView();
    } catch (error) {
      showError(error.message || t('领取失败'));
    } finally {
      setClaiming(false);
    }
  }, [refreshGameInfo, t, updateView, userDispatch, userState?.user]);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    refreshGameInfo()
      .catch((error) => {
        if (mounted) showError(error.message || t('加载小游戏失败'));
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });
    drawGame(canvasRef.current, null);
    return () => {
      mounted = false;
      stopLoop();
    };
  }, [refreshGameInfo, stopLoop, t]);

  useEffect(() => {
    const onKeyDown = (event) => {
      if (activeView !== 'tetris') return;
      if (!gameRef.current?.running || gameRef.current?.over) return;
      if (
        ['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(
          event.key,
        )
      ) {
        event.preventDefault();
      }
      if (event.key === 'ArrowLeft') applyAction('left');
      if (event.key === 'ArrowRight') applyAction('right');
      if (event.key === 'ArrowDown') applyAction('down');
      if (event.key === 'ArrowUp') applyAction('rotate');
      if (event.key === ' ') applyAction('drop');
      if (event.key.toLowerCase() === 'p') togglePause();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [activeView, applyAction, togglePause]);

  useEffect(() => {
    if (activeView === 'tetris') {
      updateView();
    }
  }, [activeView, updateView]);

  const disabledReason = !gameInfo?.enabled
    ? t('小游戏功能未启用')
    : !tetris?.enabled
      ? t('俄罗斯方块暂未开放')
      : '';
  const sidebarToggleLabel = sidebarCollapsed
    ? t('打开侧边栏')
    : t('收起侧边栏');

  return (
    <div
      className={`games-page ${
        sidebarCollapsed ? 'is-games-sidebar-collapsed' : ''
      }`}
    >
      <main className='games-shell'>
        <header className='games-hero'>
          <p className='games-eyebrow'>{t('小游戏')}</p>
          <h1>{t('玩游戏获取额度')}</h1>
          <p>
            {t('完成小游戏后按得分结算奖励额度，每日获取量受系统设置限制。')}
          </p>
        </header>

        <Spin spinning={loading}>
          <section className='games-app-layout'>
            <aside className='games-sidebar'>
              <nav className='games-card games-side-nav' aria-label={t('小游戏')}>
                <section className='games-sidebar-section'>
                  {!sidebarCollapsed && (
                    <div className='games-sidebar-group-label'>
                      {t('游戏列表')}
                    </div>
                  )}
                  <button
                    type='button'
                    className={`games-nav-item ${
                      activeView === 'tetris' ? 'is-active' : ''
                    }`}
                    onClick={() => setActiveView('tetris')}
                  >
                    <Trophy size={18} />
                    <span>{t('俄罗斯方块')}</span>
                  </button>
                </section>

                <div className='games-sidebar-divider' />

                <section className='games-sidebar-section'>
                  {!sidebarCollapsed && (
                    <div className='games-sidebar-group-label'>
                      {t('额度明细')}
                    </div>
                  )}
                  <div className='games-sidebar-quota-list'>
                    <div className='games-sidebar-quota-item'>
                      <span>{t('今日已获取')}</span>
                      <strong>
                        {renderQuota(gameInfo?.daily_earned || 0)}
                      </strong>
                    </div>
                    <div className='games-sidebar-quota-item'>
                      <span>{t('今日剩余')}</span>
                      <strong>
                        {renderQuota(gameInfo?.daily_remaining || 0)}
                      </strong>
                    </div>
                    <div className='games-sidebar-quota-item'>
                      <span>{t('每日上限')}</span>
                      <strong>{renderQuota(gameInfo?.daily_limit || 0)}</strong>
                    </div>
                  </div>
                  <button
                    type='button'
                    className={`games-nav-item ${
                      activeView === 'history' ? 'is-active' : ''
                    }`}
                    onClick={() => setActiveView('history')}
                  >
                    <Gift size={18} />
                    <span>{t('最近记录')}</span>
                  </button>
                </section>
              </nav>
              <button
                type='button'
                className='games-sidebar-collapse-button'
                title={sidebarToggleLabel}
                aria-label={sidebarToggleLabel}
                onClick={() => setSidebarCollapsed((value) => !value)}
              >
                {sidebarCollapsed ? (
                  <PanelLeftOpen size={18} />
                ) : (
                  <PanelLeftClose size={18} />
                )}
                <span>{sidebarToggleLabel}</span>
              </button>
            </aside>

            <section className='games-content'>
              {activeView === 'tetris' ? (
                <>
                  <section className='games-tetris-layout'>
                    <article className='games-card games-board-card'>
                  <div className='games-card-heading'>
                    <div>
                      <h2>{t('俄罗斯方块')}</h2>
                      <p>
                        {t('每 {{score}} 分可领取 {{quota}} 额度', {
                          score: tetris?.score_per_quota || 0,
                          quota: renderQuota(1),
                        })}
                      </p>
                    </div>
                  </div>

                  <div className='games-play-area'>
                    <canvas
                      ref={canvasRef}
                      width={COLS * CELL}
                      height={ROWS * CELL}
                      className='games-tetris-canvas'
                      aria-label={t('俄罗斯方块游戏区域')}
                    />
                    <aside className='games-panel'>
                      <div className='games-stat'>
                        <span>{t('得分')}</span>
                        <strong>{snapshot.score.toLocaleString()}</strong>
                      </div>
                      <div className='games-stat-row'>
                        <div className='games-stat'>
                          <span>{t('消行')}</span>
                          <strong>{snapshot.lines}</strong>
                        </div>
                        <div className='games-stat'>
                          <span>{t('等级')}</span>
                          <strong>{snapshot.level + 1}</strong>
                        </div>
                      </div>
                      <div className='games-stat'>
                        <span>{t('预计可领取')}</span>
                        <strong>{renderQuota(rewardPreview)}</strong>
                      </div>

                      <div className='games-actions'>
                        <Button
                          icon={
                            snapshot.running ? (
                              <RefreshCw size={16} />
                            ) : (
                              <Play size={16} />
                            )
                          }
                          theme='solid'
                          type='primary'
                          disabled={Boolean(disabledReason)}
                          loading={starting}
                          onClick={startGame}
                        >
                          {snapshot.running ? t('重新开始') : t('开始游戏')}
                        </Button>
                        <Button
                          icon={
                            snapshot.paused ? (
                              <Play size={16} />
                            ) : (
                              <Pause size={16} />
                            )
                          }
                          disabled={!snapshot.running || snapshot.over}
                          onClick={togglePause}
                        >
                          {snapshot.paused ? t('继续') : t('暂停')}
                        </Button>
                        <Button
                          icon={<Gift size={16} />}
                          disabled={
                            !snapshot.over ||
                            rewardPreview <= 0 ||
                            !sessionTokenRef.current
                          }
                          loading={claiming}
                          onClick={claimReward}
                        >
                          {t('领取额度')}
                        </Button>
                      </div>

                      {disabledReason && (
                        <p className='games-muted'>{disabledReason}</p>
                      )}
                      {snapshot.over && (
                        <p className='games-result'>{t('本局已结束')}</p>
                      )}

                      <div className='games-controls'>
                        <Button
                          className='games-control-button games-control-left'
                          icon={<ArrowLeft size={18} />}
                          onClick={() => applyAction('left')}
                        />
                        <Button
                          className='games-control-button games-control-rotate'
                          icon={<RotateCw size={18} />}
                          onClick={() => applyAction('rotate')}
                        />
                        <Button
                          className='games-control-button games-control-right'
                          icon={<ArrowRight size={18} />}
                          onClick={() => applyAction('right')}
                        />
                        <Button
                          className='games-control-button games-control-down'
                          icon={<ArrowDown size={18} />}
                          onClick={() => applyAction('down')}
                        />
                      </div>
                    </aside>
                  </div>
                    </article>
                    <aside className='games-tetris-records'>
                    <article className='games-card games-best-card'>
                      <div className='games-card-heading games-card-heading-compact'>
                        <div>
                          <h2>{t('我的最高纪录')}</h2>
                          <p>{t('查看自己的俄罗斯方块最高得分')}</p>
                        </div>
                        <Medal size={20} />
                      </div>
                      {hasTetrisBestRecord ? (
                        <>
                          <div className='games-best-score'>
                            <span>{t('最高分')}</span>
                            <strong>
                              {formatScore(tetrisBestRecord.score)}
                            </strong>
                          </div>
                          <div className='games-record-meta'>
                            <div>
                              <span>{t('游玩次数')}</span>
                              <strong>
                                {formatScore(tetrisBestRecord.play_count)}
                              </strong>
                            </div>
                            <div>
                              <span>{t('获得额度')}</span>
                              <strong>
                                {renderQuota(
                                  tetrisBestRecord.quota_awarded || 0,
                                )}
                              </strong>
                            </div>
                          </div>
                        </>
                      ) : (
                        <Empty description={t('暂无最高纪录')} />
                      )}
                    </article>

                    <article className='games-card games-leaderboard-card'>
                      <div className='games-card-heading games-card-heading-compact'>
                        <div>
                          <h2>{t('平台前十排行榜')}</h2>
                          <p>{t('按每位用户的最高分排序')}</p>
                        </div>
                      </div>
                      {tetrisLeaderboard.length ? (
                        <ol className='games-leaderboard-list'>
                          {tetrisLeaderboard.map((record, index) => (
                            <li key={`${record.user_id}-${record.score}`}>
                              <span className='games-rank-badge'>
                                {index + 1}
                              </span>
                              <div>
                                <strong>
                                  {record.username || t('未知用户')}
                                </strong>
                                <span>
                                  {t('游玩次数')}{' '}
                                  {formatScore(record.play_count)}
                                </span>
                              </div>
                              <div>
                                <strong>{formatScore(record.score)}</strong>
                                <span>{renderQuota(record.quota_awarded || 0)}</span>
                              </div>
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <Empty description={t('暂无排行数据')} />
                      )}
                    </article>
                    </aside>
                  </section>
                </>
              ) : (
                <article className='games-card games-history-card'>
                  <div className='games-card-heading games-card-heading-compact'>
                    <div>
                      <h2>{t('最近记录')}</h2>
                      <p>{t('小游戏额度领取记录')}</p>
                    </div>
                  </div>
                  {gameInfo?.recent_plays?.length ? (
                    <ol className='games-history-list'>
                      {gameInfo.recent_plays.map((play) => (
                        <li key={play.id}>
                          <div>
                            <strong>{t('俄罗斯方块')}</strong>
                            <span>
                              {new Date(
                                (play.created_at || 0) * 1000,
                              ).toLocaleString()}
                            </span>
                          </div>
                          <div>
                            <strong>{play.score.toLocaleString()}</strong>
                            <span>{renderQuota(play.quota_awarded)}</span>
                          </div>
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <Empty description={t('暂无小游戏记录')} />
                  )}
                </article>
              )}
            </section>
          </section>
        </Spin>
      </main>
    </div>
  );
};

export default Games;
