package model

import (
	"strings"
	"testing"

	"github.com/QuantumNous/new-api/common"
	"github.com/QuantumNous/new-api/setting/operation_setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func configureMiniGameForTest(t *testing.T, scorePerQuota int, dailyLimit int) {
	t.Helper()
	setting := operation_setting.GetMiniGameSetting()
	previous := *setting
	*setting = operation_setting.MiniGameSetting{
		Enabled:             true,
		TetrisEnabled:       true,
		TetrisScorePerQuota: scorePerQuota,
		DailyQuotaLimit:     dailyLimit,
	}
	t.Cleanup(func() {
		*setting = previous
	})
}

func insertMiniGameUser(t *testing.T, id int, quota int) {
	t.Helper()
	require.NoError(t, DB.Create(&User{
		Id:       id,
		Username: "mini_game_user",
		Status:   common.UserStatusEnabled,
		Quota:    quota,
	}).Error)
}

func TestClaimMiniGameRewardCapsDailyLimitAndRejectsRepeatedSession(t *testing.T) {
	truncateTables(t)
	configureMiniGameForTest(t, 100, 5)
	insertMiniGameUser(t, 301, 10)

	session, err := StartMiniGameSession(301, MiniGameKeyTetris)
	require.NoError(t, err)
	require.NotEmpty(t, session.SessionToken)

	play, stats, err := ClaimMiniGameReward(301, MiniGameKeyTetris, session.SessionToken, 900, 30)
	require.NoError(t, err)
	require.NotNil(t, play)
	assert.Equal(t, 900, play.Score)
	assert.Equal(t, 5, play.QuotaAwarded)
	assert.Equal(t, int64(5), stats.QuotaAwarded)
	assert.Equal(t, int64(1), stats.PlayCount)

	var user User
	require.NoError(t, DB.Select("quota").Where("id = ?", 301).First(&user).Error)
	assert.Equal(t, 15, user.Quota)

	_, _, err = ClaimMiniGameReward(301, MiniGameKeyTetris, session.SessionToken, 900, 30)
	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "已结算"))

	nextSession, err := StartMiniGameSession(301, MiniGameKeyTetris)
	require.NoError(t, err)
	_, _, err = ClaimMiniGameReward(301, MiniGameKeyTetris, nextSession.SessionToken, 100, 10)
	require.Error(t, err)
	assert.True(t, strings.Contains(err.Error(), "已达上限"))

	var playCount int64
	require.NoError(t, DB.Model(&MiniGamePlay{}).Where("user_id = ?", 301).Count(&playCount).Error)
	assert.Equal(t, int64(1), playCount)
}

func TestMiniGameBestRecordAndLeaderboardUseHighestScorePerUser(t *testing.T) {
	truncateTables(t)

	require.NoError(t, DB.Create([]User{
		{Id: 401, Username: "tetris_alice", DisplayName: "Alice", Status: common.UserStatusEnabled, AffCode: "tetris_alice_aff"},
		{Id: 402, Username: "tetris_bob", DisplayName: "Bob", Status: common.UserStatusEnabled, AffCode: "tetris_bob_aff"},
		{Id: 403, Username: "tetris_cora", DisplayName: "Cora", Status: common.UserStatusEnabled, AffCode: "tetris_cora_aff"},
	}).Error)
	require.NoError(t, DB.Create([]MiniGamePlay{
		{UserId: 401, GameKey: MiniGameKeyTetris, PlayDate: "2026-06-27", Score: 300, DurationSeconds: 20, QuotaAwarded: 3, CreatedAt: 100},
		{UserId: 401, GameKey: MiniGameKeyTetris, PlayDate: "2026-06-27", Score: 900, DurationSeconds: 42, QuotaAwarded: 9, CreatedAt: 101},
		{UserId: 402, GameKey: MiniGameKeyTetris, PlayDate: "2026-06-27", Score: 1000, DurationSeconds: 60, QuotaAwarded: 10, CreatedAt: 102},
		{UserId: 403, GameKey: MiniGameKeyTetris, PlayDate: "2026-06-27", Score: 120, DurationSeconds: 15, QuotaAwarded: 1, CreatedAt: 103},
	}).Error)

	best, err := GetUserMiniGameBestRecord(401, MiniGameKeyTetris)
	require.NoError(t, err)
	assert.Equal(t, 900, best.Score)
	assert.Equal(t, int64(2), best.PlayCount)
	assert.Equal(t, "Alice", best.Username)
	assert.Equal(t, 42, best.DurationSeconds)

	leaderboard, err := GetMiniGameLeaderboard(MiniGameKeyTetris, 10)
	require.NoError(t, err)
	require.Len(t, leaderboard, 3)
	assert.Equal(t, []int{402, 401, 403}, []int{
		leaderboard[0].UserId,
		leaderboard[1].UserId,
		leaderboard[2].UserId,
	})
	assert.Equal(t, 1000, leaderboard[0].Score)
	assert.Equal(t, int64(2), leaderboard[1].PlayCount)

	empty, err := GetUserMiniGameBestRecord(499, MiniGameKeyTetris)
	require.NoError(t, err)
	assert.Equal(t, 0, empty.Score)
	assert.Equal(t, int64(0), empty.PlayCount)
}
